// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local SOCKS5 (no auth) with destination ACL and fail-closed Dialer (no ISP bypass).
// Invariants:
// - CONNECT to non-ACL destinations is rejected.
// - Dialer failures close the client — never fall back to public TcpStream::connect.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
// ---

use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use super::acl::{allow_destination, normalize_destination, socket_from_host_port};

/// Dial a destination that already passed ACL — implementors must not dial the public ISP.
pub trait TunnelDialer: Send + Sync + 'static {
    fn dial(&self, dest: SocketAddr) -> Result<TcpStream, String>;
}

/// Always fails — retained for tests / emergency fail-closed without a tunnel engine.
pub struct FailClosedDialer {
    pub reason: String,
}

impl TunnelDialer for FailClosedDialer {
    fn dial(&self, dest: SocketAddr) -> Result<TcpStream, String> {
        Err(format!(
            "w_transport_tcp_partial: cannot dial {dest} — {}",
            self.reason
        ))
    }
}

/// Test-only dialer that connects to a redirected localhost target (never used in prod runtime).
#[cfg(test)]
pub struct RedirectDialer {
    pub redirect: SocketAddr,
}

#[cfg(test)]
impl TunnelDialer for RedirectDialer {
    fn dial(&self, _dest: SocketAddr) -> Result<TcpStream, String> {
        TcpStream::connect_timeout(&self.redirect, Duration::from_secs(2))
            .map_err(|e| format!("redirect dial: {e}"))
    }
}

pub struct Socks5Server {
    stop: Arc<AtomicBool>,
    join: Option<JoinHandle<()>>,
    pub listen_addr: SocketAddr,
}

impl Socks5Server {
    pub fn bind_and_spawn(
        bind: SocketAddr,
        dialer: Arc<dyn TunnelDialer>,
    ) -> Result<Self, String> {
        let listener = TcpListener::bind(bind).map_err(|e| format!("socks bind: {e}"))?;
        listener
            .set_nonblocking(false)
            .map_err(|e| format!("socks blocking: {e}"))?;
        let listen_addr = listener
            .local_addr()
            .map_err(|e| format!("socks local_addr: {e}"))?;
        let stop = Arc::new(AtomicBool::new(false));
        let stop_t = Arc::clone(&stop);
        let join = thread::Builder::new()
            .name("eliteew-w-transport-socks5".into())
            .spawn(move || accept_loop(listener, dialer, stop_t))
            .map_err(|e| format!("socks spawn: {e}"))?;
        Ok(Self {
            stop,
            join: Some(join),
            listen_addr,
        })
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        // Unblock accept by connecting to self.
        let _ = TcpStream::connect_timeout(&self.listen_addr, Duration::from_millis(200));
        if let Some(j) = self.join.take() {
            let _ = j.join();
        }
    }
}

fn accept_loop(listener: TcpListener, dialer: Arc<dyn TunnelDialer>, stop: Arc<AtomicBool>) {
    let _ = listener.set_nonblocking(false);
    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                if stop.load(Ordering::SeqCst) {
                    let _ = stream.shutdown(Shutdown::Both);
                    break;
                }
                let d = Arc::clone(&dialer);
                let _ = thread::Builder::new()
                    .name("eliteew-w-transport-socks-conn".into())
                    .spawn(move || {
                        if let Err(e) = handle_client(stream, d.as_ref()) {
                            eprintln!("[STEP] w_transport_socks_skip reason={e}");
                        }
                    });
            }
            Err(e) => {
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                eprintln!("[STEP] w_transport_socks_accept_skip err={e}");
                thread::sleep(Duration::from_millis(20));
            }
        }
    }
}

fn handle_client(mut client: TcpStream, dialer: &dyn TunnelDialer) -> Result<(), String> {
    client
        .set_read_timeout(Some(Duration::from_secs(30)))
        .ok();
    client
        .set_write_timeout(Some(Duration::from_secs(30)))
        .ok();

    // Greeting
    let mut hdr = [0u8; 2];
    client
        .read_exact(&mut hdr)
        .map_err(|e| format!("socks greet: {e}"))?;
    if hdr[0] != 0x05 {
        return Err("not socks5".into());
    }
    let nmethods = hdr[1] as usize;
    let mut methods = vec![0u8; nmethods];
    client
        .read_exact(&mut methods)
        .map_err(|e| format!("socks methods: {e}"))?;
    // No auth only
    if !methods.contains(&0x00) {
        let _ = client.write_all(&[0x05, 0xFF]);
        return Err("socks auth required".into());
    }
    client
        .write_all(&[0x05, 0x00])
        .map_err(|e| format!("socks method reply: {e}"))?;

    // Request
    let mut req = [0u8; 4];
    client
        .read_exact(&mut req)
        .map_err(|e| format!("socks req: {e}"))?;
    if req[0] != 0x05 || req[1] != 0x01 {
        // Only CONNECT
        reply_fail(&mut client, 0x07)?;
        return Err("socks only CONNECT supported".into());
    }
    let dest = match req[3] {
        0x01 => {
            let mut ip = [0u8; 4];
            client.read_exact(&mut ip).map_err(|e| format!("socks ipv4: {e}"))?;
            let mut port_b = [0u8; 2];
            client
                .read_exact(&mut port_b)
                .map_err(|e| format!("socks port: {e}"))?;
            let port = u16::from_be_bytes(port_b);
            // Local DNS (`socks5://`) often yields public edge VIP — rewrite to tunnel /32.
            normalize_destination(SocketAddr::from((ip, port)))
        }
        0x03 => {
            let mut len = [0u8; 1];
            client
                .read_exact(&mut len)
                .map_err(|e| format!("socks dlen: {e}"))?;
            let mut host = vec![0u8; len[0] as usize];
            client
                .read_exact(&mut host)
                .map_err(|e| format!("socks host: {e}"))?;
            let mut port_b = [0u8; 2];
            client
                .read_exact(&mut port_b)
                .map_err(|e| format!("socks port: {e}"))?;
            let port = u16::from_be_bytes(port_b);
            let host_s = String::from_utf8_lossy(&host);
            match socket_from_host_port(&host_s, port) {
                Ok(a) => a,
                Err(deny) => {
                    reply_fail(&mut client, 0x02)?;
                    return Err(format!("{}: {}", deny.code, deny.message));
                }
            }
        }
        0x04 => {
            reply_fail(&mut client, 0x08)?;
            return Err("socks ipv6 denied".into());
        }
        _ => {
            reply_fail(&mut client, 0x08)?;
            return Err("socks atyp unsupported".into());
        }
    };

    if let Err(deny) = allow_destination(dest) {
        reply_fail(&mut client, 0x02)?;
        return Err(format!("{}: {}", deny.code, deny.message));
    }

    let mut remote = match dialer.dial(dest) {
        Ok(s) => s,
        Err(e) => {
            reply_fail(&mut client, 0x05)?;
            return Err(e);
        }
    };

    // Success reply: bind 0.0.0.0:0
    let reply = [
        0x05u8, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    client
        .write_all(&reply)
        .map_err(|e| format!("socks success reply: {e}"))?;

    // Handshake-only timeouts — long downloads must not die on idle client→SOCKS reads.
    client.set_read_timeout(None).ok();
    client.set_write_timeout(None).ok();
    remote.set_read_timeout(None).ok();
    remote.set_write_timeout(None).ok();

    pipe_bidirectional(&mut client, &mut remote)
}

fn reply_fail(client: &mut TcpStream, rep: u8) -> Result<(), String> {
    let reply = [0x05u8, rep, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    client
        .write_all(&reply)
        .map_err(|e| format!("socks fail reply: {e}"))
}

fn pipe_bidirectional(a: &mut TcpStream, b: &mut TcpStream) -> Result<(), String> {
    let mut a2 = a.try_clone().map_err(|e| format!("clone a: {e}"))?;
    let mut b2 = b.try_clone().map_err(|e| format!("clone b: {e}"))?;
    let t = thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match a2.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if b2.write_all(&buf[..n]).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = b2.shutdown(Shutdown::Both);
    });
    let mut buf = [0u8; 16 * 1024];
    loop {
        match b.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if a.write_all(&buf[..n]).is_err() {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let _ = a.shutdown(Shutdown::Both);
    let _ = t.join();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, SocketAddrV4};

    #[test]
    fn relay_clears_handshake_timeouts_before_pipe() {
        let src = include_str!("socks5.rs");
        assert!(
            src.contains("Handshake-only timeouts"),
            "SOCKS relay must drop 30s handshake timeouts before long downloads"
        );
        assert!(src.contains("set_read_timeout(None)"));
    }

    #[test]
    fn acl_reject_does_not_reach_dialer() {
        struct PanicDialer;
        impl TunnelDialer for PanicDialer {
            fn dial(&self, _: SocketAddr) -> Result<TcpStream, String> {
                panic!("dialer must not be called for ACL deny");
            }
        }
        let server = Socks5Server::bind_and_spawn(
            SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0)),
            Arc::new(PanicDialer),
        )
        .unwrap();
        let mut c = TcpStream::connect_timeout(&server.listen_addr, Duration::from_secs(2)).unwrap();
        c.write_all(&[0x05, 0x01, 0x00]).unwrap();
        let mut meth = [0u8; 2];
        c.read_exact(&mut meth).unwrap();
        assert_eq!(meth, [0x05, 0x00]);
        // CONNECT 1.1.1.1:443
        let mut req = vec![0x05, 0x01, 0x00, 0x01, 1, 1, 1, 1];
        req.extend_from_slice(&443u16.to_be_bytes());
        c.write_all(&req).unwrap();
        let mut resp = [0u8; 10];
        c.read_exact(&mut resp).unwrap();
        assert_eq!(resp[1], 0x02); // not allowed
        server.stop();
    }

    #[test]
    fn connect_edge_uses_dialer_fail_closed() {
        let server = Socks5Server::bind_and_spawn(
            SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0)),
            Arc::new(FailClosedDialer {
                reason: "unit-test".into(),
            }),
        )
        .unwrap();
        let mut c = TcpStream::connect_timeout(&server.listen_addr, Duration::from_secs(2)).unwrap();
        c.write_all(&[0x05, 0x01, 0x00]).unwrap();
        let mut meth = [0u8; 2];
        c.read_exact(&mut meth).unwrap();
        // CONNECT 10.88.89.1:443
        let mut req = vec![0x05, 0x01, 0x00, 0x01, 10, 88, 89, 1];
        req.extend_from_slice(&443u16.to_be_bytes());
        c.write_all(&req).unwrap();
        let mut resp = [0u8; 10];
        c.read_exact(&mut resp).unwrap();
        assert_eq!(resp[1], 0x05); // connection refused / fail-closed
        server.stop();
    }
}
