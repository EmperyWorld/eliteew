// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Userspace TCP-over-WireGuard: boringtun crypto + smoltcp IP/TCP + localhost
// bridge so SOCKS CONNECT can dial AllowedIPs without a kernel wg iface.
// Invariants:
// - Never dials the public ISP for product destinations (fail-closed).
// - AllowedIPs remain 10.88.89.1/32 family; no OS-wide VPN.
// - Bridge pump is lossless: smoltcp RX is consumed only for bytes queued/written;
//   WouldBlock never silently drops payload.
// - Engine readiness is truthful (ready only after UDP bind; false on thread exit).
// - Idle Established sockets must not busy-spin: wait(0) only for real drain work;
//   localhost bridge FDs are mio-registered (canon event-driven poll).
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3 / W-transport
// ---

use std::collections::{HashMap, VecDeque};
use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU16, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender, SyncSender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use base64::Engine;
use boringtun::noise::{Tunn, TunnResult};
use boringtun::x25519::{PublicKey, StaticSecret};
use mio::net::{TcpStream as MioTcpStream, UdpSocket as MioUdpSocket};
use mio::{Events, Interest, Poll, Token, Waker};
use smoltcp::iface::{Config, Interface, SocketHandle, SocketSet};
use smoltcp::phy::{Device, DeviceCapabilities, Medium, RxToken, TxToken};
use smoltcp::socket::tcp::{self, SocketBuffer, State as TcpState};
use smoltcp::time::{Duration as SmolDuration, Instant as SmolInstant};
use smoltcp::wire::{HardwareAddress, IpAddress, IpCidr, Ipv4Address};

use super::acl::allow_destination;
use super::config::{UserspacePeerConfig, EDGE_IPV4};
use super::socks5::TunnelDialer;

const MAX_PACKET: usize = 65535;
const TCP_BUF: usize = 512 * 1024;
const IO_BUF: usize = 64 * 1024;
const MAX_PENDING_BYTES: usize = 2 * 1024 * 1024;
const MAX_ACTIVE_CONNS: usize = 32;
const MAX_BURST: usize = 16;
const DIAL_TIMEOUT: Duration = Duration::from_secs(12);
const POLL_MAX_IDLE: Duration = Duration::from_millis(50);
const TOKEN_WAKER: Token = Token(0);
const TOKEN_UDP: Token = Token(1);
/// Bridge tokens are allocated from this base upward (never collide with waker/udp).
const TOKEN_BRIDGE_BASE: usize = 10;

/// Sanitized engine counters (no URLs, keys, content IDs, or PII).
#[derive(Debug, Default)]
pub struct TransportCounters {
    pub bytes_to_bridge: AtomicU64,
    pub bytes_from_bridge: AtomicU64,
    pub udp_rx_packets: AtomicU64,
    pub udp_tx_packets: AtomicU64,
    pub would_block_writes: AtomicU64,
    pub dropped_conns_backpressure: AtomicU64,
    pub engine_iterations: AtomicU64,
}

impl TransportCounters {
    pub fn snapshot(&self) -> TransportCountersSnapshot {
        TransportCountersSnapshot {
            bytes_to_bridge: self.bytes_to_bridge.load(Ordering::Relaxed),
            bytes_from_bridge: self.bytes_from_bridge.load(Ordering::Relaxed),
            udp_rx_packets: self.udp_rx_packets.load(Ordering::Relaxed),
            udp_tx_packets: self.udp_tx_packets.load(Ordering::Relaxed),
            would_block_writes: self.would_block_writes.load(Ordering::Relaxed),
            dropped_conns_backpressure: self
                .dropped_conns_backpressure
                .load(Ordering::Relaxed),
            engine_iterations: self.engine_iterations.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct TransportCountersSnapshot {
    pub bytes_to_bridge: u64,
    pub bytes_from_bridge: u64,
    pub udp_rx_packets: u64,
    pub udp_tx_packets: u64,
    pub would_block_writes: u64,
    pub dropped_conns_backpressure: u64,
    pub engine_iterations: u64,
}

#[derive(Debug)]
enum TunnelCmd {
    Dial {
        dest: SocketAddr,
        bridge: TcpStream,
        reply: SyncSender<Result<(), String>>,
    },
    Stop,
}

struct PendingDial {
    handle: SocketHandle,
    bridge: TcpStream,
    reply: SyncSender<Result<(), String>>,
    started: Instant,
    answered: bool,
}

struct ActiveConn {
    handle: SocketHandle,
    bridge: MioTcpStream,
    token: Token,
    interest: Interest,
    /// smoltcp → SOCKS (lossless backlog)
    to_bridge: VecDeque<u8>,
    /// SOCKS → smoltcp (lossless backlog)
    to_smol: VecDeque<u8>,
}

/// Zero-timeout engine wake only when bytes must be drained without waiting for I/O.
/// Do **not** treat bare `can_send` as busy: Established TCP almost always can send,
/// which previously pegged one core for the lifetime of HTTP keepalives.
fn needs_immediate_engine_wake(to_smol_nonempty: bool, can_recv: bool, can_send: bool) -> bool {
    can_recv || (to_smol_nonempty && can_send)
}

fn register_active_bridge(
    poll: &Poll,
    bridge: TcpStream,
    token: Token,
) -> Result<MioTcpStream, String> {
    let mut mio_bridge = MioTcpStream::from_std(bridge);
    poll.registry()
        .register(&mut mio_bridge, token, Interest::READABLE)
        .map_err(|e| format!("bridge register: {e}"))?;
    Ok(mio_bridge)
}

fn refresh_bridge_interest(poll: &Poll, conn: &mut ActiveConn) {
    let mut want = Interest::READABLE;
    if !conn.to_bridge.is_empty() {
        want |= Interest::WRITABLE;
    }
    if want == conn.interest {
        return;
    }
    if poll
        .registry()
        .reregister(&mut conn.bridge, conn.token, want)
        .is_ok()
    {
        conn.interest = want;
    }
}

fn deregister_bridge(poll: &Poll, conn: &mut ActiveConn) {
    let _ = poll.registry().deregister(&mut conn.bridge);
}

struct IpPacketDevice {
    rx: VecDeque<Vec<u8>>,
    tx: VecDeque<Vec<u8>>,
    mtu: usize,
    packet_pool: Vec<Vec<u8>>,
}

impl IpPacketDevice {
    fn new(mtu: u16) -> Self {
        Self {
            rx: VecDeque::new(),
            tx: VecDeque::new(),
            mtu: mtu as usize,
            packet_pool: Vec::with_capacity(64),
        }
    }

    fn take_buf(&mut self, min_len: usize) -> Vec<u8> {
        if let Some(mut v) = self.packet_pool.pop() {
            v.clear();
            if v.capacity() < min_len {
                v.reserve(min_len);
            }
            v.resize(min_len, 0);
            v
        } else {
            vec![0u8; min_len]
        }
    }

    fn recycle(&mut self, mut buf: Vec<u8>) {
        if self.packet_pool.len() < 128 && buf.capacity() <= MAX_PACKET {
            buf.clear();
            self.packet_pool.push(buf);
        }
    }

    fn push_rx_copy(&mut self, packet: &[u8]) {
        let mut buf = self.take_buf(packet.len());
        buf.clear();
        buf.extend_from_slice(packet);
        self.rx.push_back(buf);
    }
}

impl Device for IpPacketDevice {
    type RxToken<'a>
        = IpRxToken
    where
        Self: 'a;
    type TxToken<'a>
        = IpTxToken<'a>
    where
        Self: 'a;

    fn receive(&mut self, _timestamp: SmolInstant) -> Option<(Self::RxToken<'_>, Self::TxToken<'_>)> {
        let packet = self.rx.pop_front()?;
        Some((
            IpRxToken { packet },
            IpTxToken {
                tx: &mut self.tx,
                pool: &mut self.packet_pool,
            },
        ))
    }

    fn transmit(&mut self, _timestamp: SmolInstant) -> Option<Self::TxToken<'_>> {
        Some(IpTxToken {
            tx: &mut self.tx,
            pool: &mut self.packet_pool,
        })
    }

    fn capabilities(&self) -> DeviceCapabilities {
        let mut caps = DeviceCapabilities::default();
        caps.medium = Medium::Ip;
        caps.max_transmission_unit = self.mtu;
        caps.max_burst_size = Some(MAX_BURST);
        caps
    }
}

struct IpRxToken {
    packet: Vec<u8>,
}

impl RxToken for IpRxToken {
    fn consume<R, F>(self, f: F) -> R
    where
        F: FnOnce(&[u8]) -> R,
    {
        f(&self.packet)
    }
}

struct IpTxToken<'a> {
    tx: &'a mut VecDeque<Vec<u8>>,
    pool: &'a mut Vec<Vec<u8>>,
}

impl TxToken for IpTxToken<'_> {
    fn consume<R, F>(self, len: usize, f: F) -> R
    where
        F: FnOnce(&mut [u8]) -> R,
    {
        let mut buf = if let Some(mut v) = self.pool.pop() {
            v.clear();
            if v.capacity() < len {
                v.reserve(len);
            }
            v.resize(len, 0);
            v
        } else {
            vec![0u8; len]
        };
        let result = f(&mut buf);
        self.tx.push_back(buf);
        result
    }
}

/// Running userspace WG + smoltcp engine used by SOCKS CONNECT.
pub struct WgTcpTunnel {
    cmd_tx: Mutex<Option<Sender<TunnelCmd>>>,
    waker: Mutex<Option<Arc<Waker>>>,
    stop: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
    alive: Arc<AtomicBool>,
    counters: Arc<TransportCounters>,
    join: Mutex<Option<JoinHandle<()>>>,
}

impl WgTcpTunnel {
    /// Bring up UDP+boringtun+smoltcp poll thread. Ready flag stays false until bind succeeds.
    pub fn start(cfg: &UserspacePeerConfig) -> Result<Self, String> {
        let params = TunnelParams::from_config(cfg)?;
        let (cmd_tx, cmd_rx) = mpsc::channel::<TunnelCmd>();
        let stop = Arc::new(AtomicBool::new(false));
        let ready = Arc::new(AtomicBool::new(false));
        let alive = Arc::new(AtomicBool::new(true));
        let counters = Arc::new(TransportCounters::default());
        let waker_slot: Arc<Mutex<Option<Arc<Waker>>>> = Arc::new(Mutex::new(None));

        let stop_t = Arc::clone(&stop);
        let ready_t = Arc::clone(&ready);
        let alive_t = Arc::clone(&alive);
        let counters_t = Arc::clone(&counters);
        let waker_slot_t = Arc::clone(&waker_slot);

        let join = thread::Builder::new()
            .name("eliteew-w-transport-tcp-wg".into())
            .spawn(move || {
                let result = tunnel_thread_inner(
                    params,
                    cmd_rx,
                    stop_t,
                    ready_t,
                    alive_t,
                    counters_t,
                    waker_slot_t,
                );
                if let Err(e) = result {
                    eprintln!("[STEP] w_transport_tcp_wg_exit err={e}");
                }
            })
            .map_err(|e| format!("tcp_over_wg spawn: {e}"))?;

        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if ready.load(Ordering::SeqCst) {
                break;
            }
            if join.is_finished() {
                alive.store(false, Ordering::SeqCst);
                return Err("w_transport_tcp_engine_died_during_start".into());
            }
            thread::sleep(Duration::from_millis(5));
        }
        if !ready.load(Ordering::SeqCst) {
            stop.store(true, Ordering::SeqCst);
            let _ = cmd_tx.send(TunnelCmd::Stop);
            let _ = join.join();
            alive.store(false, Ordering::SeqCst);
            return Err("w_transport_tcp_ready_timeout".into());
        }

        let waker = waker_slot.lock().ok().and_then(|g| g.clone());

        Ok(Self {
            cmd_tx: Mutex::new(Some(cmd_tx)),
            waker: Mutex::new(waker),
            stop,
            ready,
            alive,
            counters,
            join: Mutex::new(Some(join)),
        })
    }

    pub fn is_tcp_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
            && self.alive.load(Ordering::SeqCst)
            && !self.stop.load(Ordering::SeqCst)
    }

    pub fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst) && !self.stop.load(Ordering::SeqCst)
    }

    pub fn counters(&self) -> Arc<TransportCounters> {
        Arc::clone(&self.counters)
    }

    pub fn stop(self) {
        self.stop.store(true, Ordering::SeqCst);
        self.ready.store(false, Ordering::SeqCst);
        if let Ok(mut guard) = self.cmd_tx.lock() {
            if let Some(tx) = guard.take() {
                let _ = tx.send(TunnelCmd::Stop);
            }
        }
        if let Ok(guard) = self.waker.lock() {
            if let Some(w) = guard.as_ref() {
                let _ = w.wake();
            }
        }
        if let Ok(mut j) = self.join.lock() {
            if let Some(h) = j.take() {
                let _ = h.join();
            }
        }
        self.alive.store(false, Ordering::SeqCst);
        self.ready.store(false, Ordering::SeqCst);
    }
}

/// SOCKS dialer that opens TCP through the userspace WG tunnel (localhost bridge).
pub struct SmoltcpDialer {
    cmd_tx: Sender<TunnelCmd>,
    waker: Option<Arc<Waker>>,
    stop: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
    alive: Arc<AtomicBool>,
}

impl SmoltcpDialer {
    pub fn from_tunnel(tunnel: &WgTcpTunnel) -> Result<Self, String> {
        let guard = tunnel
            .cmd_tx
            .lock()
            .map_err(|e| format!("tunnel lock: {e}"))?;
        let tx = guard
            .as_ref()
            .ok_or_else(|| "tcp_over_wg stopped".to_string())?
            .clone();
        let waker = tunnel.waker.lock().ok().and_then(|g| g.clone());
        Ok(Self {
            cmd_tx: tx,
            waker,
            stop: Arc::clone(&tunnel.stop),
            ready: Arc::clone(&tunnel.ready),
            alive: Arc::clone(&tunnel.alive),
        })
    }
}

impl TunnelDialer for SmoltcpDialer {
    fn dial(&self, dest: SocketAddr) -> Result<TcpStream, String> {
        if self.stop.load(Ordering::SeqCst) || !self.alive.load(Ordering::SeqCst) {
            return Err("w_transport_tcp_stopped".into());
        }
        if !self.ready.load(Ordering::SeqCst) {
            return Err("w_transport_tcp_not_ready".into());
        }
        if let Err(deny) = allow_destination(dest) {
            return Err(format!("{}: {}", deny.code, deny.message));
        }

        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("bridge bind: {e}"))?;
        let bridge_addr = listener
            .local_addr()
            .map_err(|e| format!("bridge local_addr: {e}"))?;
        let client = TcpStream::connect_timeout(&bridge_addr, Duration::from_secs(2))
            .map_err(|e| format!("bridge connect: {e}"))?;
        let (bridge, _) = listener
            .accept()
            .map_err(|e| format!("bridge accept: {e}"))?;
        bridge
            .set_nonblocking(true)
            .map_err(|e| format!("bridge nonblocking: {e}"))?;
        let _ = client.set_nodelay(true);
        let _ = bridge.set_nodelay(true);

        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        self.cmd_tx
            .send(TunnelCmd::Dial {
                dest,
                bridge,
                reply: reply_tx,
            })
            .map_err(|_| "tcp_over_wg engine gone".to_string())?;
        if let Some(w) = &self.waker {
            let _ = w.wake();
        }

        match reply_rx.recv_timeout(DIAL_TIMEOUT + Duration::from_secs(1)) {
            Ok(Ok(())) => Ok(client),
            Ok(Err(e)) => Err(e),
            Err(RecvTimeoutError::Timeout) => Err(format!(
                "w_transport_tcp_timeout: dial {dest} via userspace WG exceeded {:?}",
                DIAL_TIMEOUT
            )),
            Err(RecvTimeoutError::Disconnected) => {
                Err("w_transport_tcp_engine_disconnected".into())
            }
        }
    }
}

struct TunnelParams {
    private_key: [u8; 32],
    peer_public_key: [u8; 32],
    address: Ipv4Addr,
    endpoint: SocketAddr,
    mtu: u16,
    persistent_keepalive_secs: Option<u16>,
}

impl TunnelParams {
    fn from_config(cfg: &UserspacePeerConfig) -> Result<Self, String> {
        Ok(Self {
            private_key: decode_key32(&cfg.private_key_b64)?,
            peer_public_key: decode_key32(&cfg.peer_public_key_b64)?,
            address: cfg.address,
            endpoint: cfg.endpoint,
            mtu: cfg.mtu,
            persistent_keepalive_secs: cfg.persistent_keepalive_secs,
        })
    }
}

fn decode_key32(b64: &str) -> Result<[u8; 32], String> {
    let v = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("base64 key: {e}"))?;
    if v.len() != 32 {
        return Err(format!("key length {} != 32", v.len()));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&v);
    Ok(out)
}

fn ipv4_to_smol(ip: Ipv4Addr) -> Ipv4Address {
    Ipv4Address::new(ip.octets()[0], ip.octets()[1], ip.octets()[2], ip.octets()[3])
}

fn configure_tcp_socket(socket: &mut tcp::Socket<'_>) {
    socket.set_nagle_enabled(false);
    socket.set_ack_delay(None);
}

fn smol_delay_to_std(d: SmolDuration) -> Duration {
    Duration::from_micros(d.total_micros().max(100)).min(POLL_MAX_IDLE)
}

fn flush_wg_tx(
    device: &mut IpPacketDevice,
    tunn: &mut Tunn,
    udp: &MioUdpSocket,
    endpoint: SocketAddr,
    enc_buf: &mut [u8],
    counters: &TransportCounters,
) {
    while let Some(ip_packet) = device.tx.pop_front() {
        match tunn.encapsulate(&ip_packet, enc_buf) {
            TunnResult::WriteToNetwork(p) => {
                let _ = udp.send_to(p, endpoint);
                counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
            }
            TunnResult::Done => {}
            TunnResult::Err(e) => {
                eprintln!("[STEP] w_transport_wg_encap_skip err={e:?}");
            }
            other => {
                eprintln!("[STEP] w_transport_wg_encap_skip other={other:?}");
            }
        }
        device.recycle(ip_packet);
    }
}

fn pump_bridge_to_peer(
    conn: &mut ActiveConn,
    sock: &mut tcp::Socket<'_>,
    io_buf: &mut [u8],
    counters: &TransportCounters,
) -> bool {
    // Flush to_bridge → bridge
    while !conn.to_bridge.is_empty() {
        let (front, _) = conn.to_bridge.as_slices();
        if front.is_empty() {
            conn.to_bridge.pop_front();
            continue;
        }
        match conn.bridge.write(front) {
            Ok(0) => return false,
            Ok(n) => {
                for _ in 0..n {
                    conn.to_bridge.pop_front();
                }
                counters
                    .bytes_to_bridge
                    .fetch_add(n as u64, Ordering::Relaxed);
            }
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => {
                counters
                    .would_block_writes
                    .fetch_add(1, Ordering::Relaxed);
                break;
            }
            Err(_) => return false,
        }
    }

    // smoltcp RX → to_bridge (consume only queued bytes)
    if sock.can_recv() {
        if conn.to_bridge.len() >= MAX_PENDING_BYTES {
            counters
                .dropped_conns_backpressure
                .fetch_add(1, Ordering::Relaxed);
            eprintln!("[STEP] w_transport_tcp_backpressure_close");
            return false;
        }
        let room = MAX_PENDING_BYTES - conn.to_bridge.len();
        match sock.recv(|data| {
            let n = data.len().min(room);
            if n == 0 {
                return (0, ());
            }
            conn.to_bridge.extend(data[..n].iter().copied());
            (n, ())
        }) {
            Ok(()) => {}
            Err(_) => return false,
        }
        while !conn.to_bridge.is_empty() {
            let (front, _) = conn.to_bridge.as_slices();
            if front.is_empty() {
                conn.to_bridge.pop_front();
                continue;
            }
            match conn.bridge.write(front) {
                Ok(0) => return false,
                Ok(n) => {
                    for _ in 0..n {
                        conn.to_bridge.pop_front();
                    }
                    counters
                        .bytes_to_bridge
                        .fetch_add(n as u64, Ordering::Relaxed);
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => {
                    counters
                        .would_block_writes
                        .fetch_add(1, Ordering::Relaxed);
                    break;
                }
                Err(_) => return false,
            }
        }
    }

    // bridge → to_smol
    if conn.to_smol.len() < MAX_PENDING_BYTES {
        let room = (MAX_PENDING_BYTES - conn.to_smol.len()).min(io_buf.len());
        if room > 0 {
            match conn.bridge.read(&mut io_buf[..room]) {
                Ok(0) => {
                    if conn.to_smol.is_empty() && conn.to_bridge.is_empty() && !sock.can_recv() {
                        sock.close();
                        return false;
                    }
                }
                Ok(n) => {
                    conn.to_smol.extend(io_buf[..n].iter().copied());
                    counters
                        .bytes_from_bridge
                        .fetch_add(n as u64, Ordering::Relaxed);
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => {}
                Err(_) => {
                    sock.close();
                    return false;
                }
            }
        }
    }

    while sock.can_send() && !conn.to_smol.is_empty() {
        let (front, _) = conn.to_smol.as_slices();
        if front.is_empty() {
            conn.to_smol.pop_front();
            continue;
        }
        match sock.send_slice(front) {
            Ok(0) => break,
            Ok(n) => {
                for _ in 0..n {
                    conn.to_smol.pop_front();
                }
            }
            Err(_) => return false,
        }
    }

    !matches!(sock.state(), TcpState::Closed | TcpState::TimeWait)
}

fn tunnel_thread_inner(
    params: TunnelParams,
    cmd_rx: Receiver<TunnelCmd>,
    stop: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
    alive: Arc<AtomicBool>,
    counters: Arc<TransportCounters>,
    waker_slot: Arc<Mutex<Option<Arc<Waker>>>>,
) -> Result<(), String> {
    let result = (|| {
        let sk = StaticSecret::from(params.private_key);
        let pk = PublicKey::from(params.peer_public_key);
        let mut tunn = Tunn::new(sk, pk, None, params.persistent_keepalive_secs, 0, None);

        let std_udp = UdpSocket::bind("0.0.0.0:0").map_err(|e| format!("udp bind: {e}"))?;
        std_udp
            .set_nonblocking(true)
            .map_err(|e| format!("udp nonblocking: {e}"))?;
        let mut udp = MioUdpSocket::from_std(std_udp);
        let endpoint = params.endpoint;

        let mut poll = Poll::new().map_err(|e| format!("poll: {e}"))?;
        let mut events = Events::with_capacity(64);
        let waker = Arc::new(
            Waker::new(poll.registry(), TOKEN_WAKER).map_err(|e| format!("waker: {e}"))?,
        );
        if let Ok(mut slot) = waker_slot.lock() {
            *slot = Some(Arc::clone(&waker));
        }
        poll.registry()
            .register(&mut udp, TOKEN_UDP, Interest::READABLE)
            .map_err(|e| format!("udp register: {e}"))?;

        {
            let mut buf = [0u8; 256];
            if let TunnResult::WriteToNetwork(p) = tunn.format_handshake_initiation(&mut buf, true)
            {
                let _ = udp.send_to(p, endpoint);
                counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
            }
        }

        let mut device = IpPacketDevice::new(params.mtu);
        let mut config = Config::new(HardwareAddress::Ip);
        config.random_seed = u64::from_le_bytes({
            let mut b = [0u8; 8];
            b[..4].copy_from_slice(&params.address.octets());
            b
        });
        let mut iface = Interface::new(config, &mut device, SmolInstant::now());
        let local = ipv4_to_smol(params.address);
        let edge = ipv4_to_smol(EDGE_IPV4);
        iface.update_ip_addrs(|addrs| {
            let _ = addrs.push(IpCidr::new(IpAddress::Ipv4(local), 32));
        });
        let _ = iface.routes_mut().add_default_ipv4_route(edge);

        let mut sockets = SocketSet::new(vec![]);
        let mut pending: HashMap<SocketHandle, PendingDial> = HashMap::new();
        let mut active: HashMap<SocketHandle, ActiveConn> = HashMap::new();
        let next_ephemeral = AtomicU16::new(49_152);
        let mut next_bridge_token = TOKEN_BRIDGE_BASE;

        let mut udp_buf = [0u8; MAX_PACKET];
        let mut enc_buf = [0u8; MAX_PACKET];
        let mut io_buf = [0u8; IO_BUF];

        ready.store(true, Ordering::SeqCst);
        eprintln!("[STEP] w_transport_tcp_wg_ready");

        while !stop.load(Ordering::SeqCst) {
            counters.engine_iterations.fetch_add(1, Ordering::Relaxed);

            while let Ok(cmd) = cmd_rx.try_recv() {
                match cmd {
                    TunnelCmd::Stop => {
                        stop.store(true, Ordering::SeqCst);
                        break;
                    }
                    TunnelCmd::Dial {
                        dest,
                        bridge,
                        reply,
                    } => {
                        if active.len() + pending.len() >= MAX_ACTIVE_CONNS {
                            let _ = reply.send(Err("w_transport_tcp_conn_limit".into()));
                            continue;
                        }
                        if let Err(deny) = allow_destination(dest) {
                            let _ = reply.send(Err(format!("{}: {}", deny.code, deny.message)));
                            continue;
                        }
                        let (dest_ip, dest_port) = match dest_v4(dest) {
                            Ok(v) => v,
                            Err(e) => {
                                let _ = reply.send(Err(e));
                                continue;
                            }
                        };
                        let eph = next_ephemeral.fetch_add(1, Ordering::Relaxed);
                        if eph < 49_152 {
                            next_ephemeral.store(49_152, Ordering::Relaxed);
                        }
                        let rx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                        let tx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                        let mut socket = tcp::Socket::new(rx, tx);
                        configure_tcp_socket(&mut socket);
                        let remote = (IpAddress::Ipv4(ipv4_to_smol(dest_ip)), dest_port);
                        let local_ep = (IpAddress::Ipv4(local), eph);
                        if let Err(e) = socket.connect(iface.context(), remote, local_ep) {
                            let _ = reply.send(Err(format!("smoltcp connect: {e}")));
                            continue;
                        }
                        let handle = sockets.add(socket);
                        pending.insert(
                            handle,
                            PendingDial {
                                handle,
                                bridge,
                                reply,
                                started: Instant::now(),
                                answered: false,
                            },
                        );
                    }
                }
            }
            if stop.load(Ordering::SeqCst) {
                break;
            }

            loop {
                match udp.recv_from(&mut udp_buf) {
                    Ok((n, _)) => {
                        counters.udp_rx_packets.fetch_add(1, Ordering::Relaxed);
                        match tunn.decapsulate(None, &udp_buf[..n], &mut enc_buf) {
                            TunnResult::WriteToNetwork(p) => {
                                let _ = udp.send_to(p, endpoint);
                                counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
                                loop {
                                    match tunn.decapsulate(None, &[], &mut enc_buf) {
                                        TunnResult::WriteToNetwork(p2) => {
                                            let _ = udp.send_to(p2, endpoint);
                                            counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
                                        }
                                        TunnResult::WriteToTunnelV4(packet, _)
                                        | TunnResult::WriteToTunnelV6(packet, _) => {
                                            device.push_rx_copy(packet);
                                        }
                                        _ => break,
                                    }
                                }
                            }
                            TunnResult::WriteToTunnelV4(packet, _)
                            | TunnResult::WriteToTunnelV6(packet, _) => {
                                device.push_rx_copy(packet);
                            }
                            TunnResult::Err(boringtun::noise::errors::WireGuardError::DuplicateCounter) => {}
                            TunnResult::Err(e) => {
                                eprintln!("[STEP] w_transport_wg_decap_skip err={e:?}");
                            }
                            _ => {}
                        }
                    }
                    Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
                    Err(e) => {
                        eprintln!("[STEP] w_transport_wg_udp_recv_skip err={e}");
                        break;
                    }
                }
            }

            match tunn.update_timers(&mut enc_buf) {
                TunnResult::WriteToNetwork(p) => {
                    let _ = udp.send_to(p, endpoint);
                    counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
                }
                TunnResult::Err(boringtun::noise::errors::WireGuardError::ConnectionExpired) => {
                    if let TunnResult::WriteToNetwork(p) =
                        tunn.format_handshake_initiation(&mut enc_buf, false)
                    {
                        let _ = udp.send_to(p, endpoint);
                        counters.udp_tx_packets.fetch_add(1, Ordering::Relaxed);
                    }
                }
                _ => {}
            }

            let now = SmolInstant::now();
            iface.poll(now, &mut device, &mut sockets);
            flush_wg_tx(
                &mut device,
                &mut tunn,
                &udp,
                endpoint,
                &mut enc_buf,
                &counters,
            );

            let mut promote = Vec::new();
            let mut fail = Vec::new();
            for (h, p) in pending.iter_mut() {
                let sock = sockets.get_mut::<tcp::Socket>(p.handle);
                if !p.answered && sock.state() == TcpState::Established {
                    p.answered = true;
                    let _ = p.reply.send(Ok(()));
                    promote.push(*h);
                } else if !p.answered && p.started.elapsed() > DIAL_TIMEOUT {
                    p.answered = true;
                    let _ = p.reply.send(Err(format!(
                        "w_transport_tcp_timeout: smoltcp dial incomplete (state={:?})",
                        sock.state()
                    )));
                    sock.close();
                    fail.push(*h);
                } else if !p.answered
                    && matches!(
                        sock.state(),
                        TcpState::Closed | TcpState::TimeWait | TcpState::Listen
                    )
                    && p.started.elapsed() > Duration::from_millis(50)
                {
                    p.answered = true;
                    let _ = p.reply.send(Err(format!(
                        "w_transport_tcp_closed: remote rejected (state={:?})",
                        sock.state()
                    )));
                    fail.push(*h);
                }
            }
            for h in promote {
                if let Some(p) = pending.remove(&h) {
                    let token = Token(next_bridge_token);
                    next_bridge_token = next_bridge_token.wrapping_add(1).max(TOKEN_BRIDGE_BASE);
                    match register_active_bridge(&poll, p.bridge, token) {
                        Ok(bridge) => {
                            active.insert(
                                h,
                                ActiveConn {
                                    handle: p.handle,
                                    bridge,
                                    token,
                                    interest: Interest::READABLE,
                                    to_bridge: VecDeque::new(),
                                    to_smol: VecDeque::new(),
                                },
                            );
                        }
                        Err(e) => {
                            eprintln!("[STEP] w_transport_bridge_register_fail err={e}");
                            sockets.remove(p.handle);
                        }
                    }
                }
            }
            for h in fail {
                if let Some(p) = pending.remove(&h) {
                    sockets.remove(p.handle);
                }
            }

            let mut drop_handles = Vec::new();
            for (h, conn) in active.iter_mut() {
                let sock = sockets.get_mut::<tcp::Socket>(conn.handle);
                if !pump_bridge_to_peer(conn, sock, &mut io_buf, &counters) {
                    drop_handles.push(*h);
                } else {
                    refresh_bridge_interest(&poll, conn);
                }
            }
            for h in drop_handles {
                if let Some(mut conn) = active.remove(&h) {
                    deregister_bridge(&poll, &mut conn);
                    let _ = conn.bridge.shutdown(std::net::Shutdown::Both);
                    sockets.remove(conn.handle);
                }
            }

            // Emit TCP segments produced by the pump.
            iface.poll(SmolInstant::now(), &mut device, &mut sockets);
            flush_wg_tx(
                &mut device,
                &mut tunn,
                &udp,
                endpoint,
                &mut enc_buf,
                &counters,
            );

            let immediate = active.values().any(|c| {
                let sock = sockets.get::<tcp::Socket>(c.handle);
                needs_immediate_engine_wake(!c.to_smol.is_empty(), sock.can_recv(), sock.can_send())
            });
            let wait = if immediate {
                Duration::from_millis(0)
            } else {
                iface
                    .poll_delay(SmolInstant::now(), &sockets)
                    .map(smol_delay_to_std)
                    .unwrap_or(POLL_MAX_IDLE)
            };
            if let Err(e) = poll.poll(&mut events, Some(wait)) {
                if e.kind() != io::ErrorKind::Interrupted {
                    eprintln!("[STEP] w_transport_poll_skip err={e}");
                }
            }
            let _ = events.iter().count();
        }

        for (_, p) in pending.drain() {
            if !p.answered {
                let _ = p.reply.send(Err("w_transport_tcp_stopped".into()));
            }
        }
        for (_, mut conn) in active.drain() {
            deregister_bridge(&poll, &mut conn);
            let _ = conn.bridge.shutdown(std::net::Shutdown::Both);
        }
        Ok(())
    })();

    ready.store(false, Ordering::SeqCst);
    alive.store(false, Ordering::SeqCst);
    result
}

fn dest_v4(dest: SocketAddr) -> Result<(Ipv4Addr, u16), String> {
    match dest {
        SocketAddr::V4(v4) => Ok((*v4.ip(), v4.port())),
        SocketAddr::V6(_) => Err("ipv6 denied for W-transport TCP".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddrV4;

    #[test]
    fn idle_established_can_send_does_not_force_immediate_wake() {
        // Regression lock: bare can_send used to set poll timeout 0 forever (one-core peg).
        assert!(!needs_immediate_engine_wake(false, false, true));
        assert!(needs_immediate_engine_wake(false, true, false));
        assert!(needs_immediate_engine_wake(true, false, true));
        assert!(!needs_immediate_engine_wake(true, false, false));
    }

    fn b64(key: &[u8; 32]) -> String {
        base64::engine::general_purpose::STANDARD.encode(key)
    }

    fn random_key() -> [u8; 32] {
        let sk = StaticSecret::random_from_rng(rand_core::OsRng);
        sk.to_bytes()
    }

    fn spawn_edge_echo(
        private: [u8; 32],
        peer_public: [u8; 32],
        udp_bind: SocketAddr,
        stop: Arc<AtomicBool>,
    ) -> JoinHandle<()> {
        thread::spawn(move || {
            let sk = StaticSecret::from(private);
            let pk = PublicKey::from(peer_public);
            let mut tunn = Tunn::new(sk, pk, None, Some(25), 1, None);
            let udp = UdpSocket::bind(udp_bind).expect("edge udp");
            udp.set_nonblocking(true).ok();
            let mut last_peer: Option<SocketAddr> = None;

            let mut device = IpPacketDevice::new(1380);
            let mut config = Config::new(HardwareAddress::Ip);
            config.random_seed = 42;
            let mut iface = Interface::new(config, &mut device, SmolInstant::now());
            let edge = ipv4_to_smol(EDGE_IPV4);
            iface.update_ip_addrs(|a| {
                let _ = a.push(IpCidr::new(IpAddress::Ipv4(edge), 32));
            });
            let mut sockets = SocketSet::new(vec![]);
            let mut echo_handles: Vec<SocketHandle> = Vec::new();
            // Pre-create several listeners so concurrent client dials can accept in parallel.
            for _ in 0..8 {
                let rx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                let tx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                let mut server = tcp::Socket::new(rx, tx);
                configure_tcp_socket(&mut server);
                server.listen(443).expect("listen 443");
                echo_handles.push(sockets.add(server));
            }

            let mut udp_buf = [0u8; MAX_PACKET];
            let mut enc_buf = [0u8; MAX_PACKET];
            let mut echo_buf = [0u8; IO_BUF];
            let mut echo_pending: HashMap<SocketHandle, VecDeque<u8>> = HashMap::new();

            while !stop.load(Ordering::SeqCst) {
                loop {
                    match udp.recv_from(&mut udp_buf) {
                        Ok((n, src)) => {
                            last_peer = Some(src);
                            match tunn.decapsulate(None, &udp_buf[..n], &mut enc_buf) {
                                TunnResult::WriteToNetwork(p) => {
                                    let _ = udp.send_to(p, src);
                                    loop {
                                        match tunn.decapsulate(None, &[], &mut enc_buf) {
                                            TunnResult::WriteToNetwork(p2) => {
                                                let _ = udp.send_to(p2, src);
                                            }
                                            TunnResult::WriteToTunnelV4(packet, _)
                                            | TunnResult::WriteToTunnelV6(packet, _) => {
                                                device.push_rx_copy(packet);
                                            }
                                            _ => break,
                                        }
                                    }
                                }
                                TunnResult::WriteToTunnelV4(packet, _)
                                | TunnResult::WriteToTunnelV6(packet, _) => {
                                    device.push_rx_copy(packet);
                                }
                                _ => {}
                            }
                        }
                        Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
                        Err(_) => break,
                    }
                }

                if let Some(peer) = last_peer {
                    if let TunnResult::WriteToNetwork(p) = tunn.update_timers(&mut enc_buf) {
                        let _ = udp.send_to(p, peer);
                    }
                }

                iface.poll(SmolInstant::now(), &mut device, &mut sockets);
                while let Some(ip) = device.tx.pop_front() {
                    if let Some(peer) = last_peer {
                        if let TunnResult::WriteToNetwork(p) = tunn.encapsulate(&ip, &mut enc_buf) {
                            let _ = udp.send_to(p, peer);
                        }
                    }
                    device.recycle(ip);
                }

                let mut spawn_listener = false;
                let mut drop_hs = Vec::new();
                for h in echo_handles.iter().copied() {
                    let sock = sockets.get_mut::<tcp::Socket>(h);
                    if sock.is_listening() {
                        continue;
                    }
                    if sock.state() == TcpState::Established || sock.can_recv() || sock.can_send() {
                        let pending = echo_pending.entry(h).or_default();
                        // Flush previously unsent echo bytes first (lossless).
                        while sock.can_send() && !pending.is_empty() {
                            let (front, _) = pending.as_slices();
                            if front.is_empty() {
                                pending.pop_front();
                                continue;
                            }
                            match sock.send_slice(front) {
                                Ok(0) => break,
                                Ok(m) => {
                                    for _ in 0..m {
                                        pending.pop_front();
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                        if sock.can_recv() {
                            if let Ok(n) = sock.recv_slice(&mut echo_buf) {
                                pending.extend(echo_buf[..n].iter().copied());
                                while sock.can_send() && !pending.is_empty() {
                                    let (front, _) = pending.as_slices();
                                    if front.is_empty() {
                                        pending.pop_front();
                                        continue;
                                    }
                                    match sock.send_slice(front) {
                                        Ok(0) => break,
                                        Ok(m) => {
                                            for _ in 0..m {
                                                pending.pop_front();
                                            }
                                        }
                                        Err(_) => break,
                                    }
                                }
                            }
                        }
                        if matches!(sock.state(), TcpState::Closed | TcpState::TimeWait)
                            || (!sock.is_active() && !sock.can_recv() && !sock.can_send())
                        {
                            drop_hs.push(h);
                        }
                    } else if !sock.is_active() {
                        drop_hs.push(h);
                    }
                    // When listen socket accepted a connection it is no longer listening.
                    if !sock.is_listening() && sock.is_active() {
                        spawn_listener = true;
                    }
                }
                for h in drop_hs {
                    echo_pending.remove(&h);
                    if let Some(idx) = echo_handles.iter().position(|x| *x == h) {
                        echo_handles.remove(idx);
                        sockets.remove(h);
                        spawn_listener = true;
                    }
                }
                if spawn_listener && !echo_handles.iter().any(|h| sockets.get::<tcp::Socket>(*h).is_listening())
                {
                    let rx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                    let tx = SocketBuffer::new(vec![0u8; TCP_BUF]);
                    let mut server = tcp::Socket::new(rx, tx);
                    configure_tcp_socket(&mut server);
                    if server.listen(443).is_ok() {
                        echo_handles.push(sockets.add(server));
                    }
                }

                iface.poll(SmolInstant::now(), &mut device, &mut sockets);
                while let Some(ip) = device.tx.pop_front() {
                    if let Some(peer) = last_peer {
                        if let TunnResult::WriteToNetwork(p) = tunn.encapsulate(&ip, &mut enc_buf) {
                            let _ = udp.send_to(p, peer);
                        }
                    }
                    device.recycle(ip);
                }

                let edge_busy = echo_pending.values().any(|q| !q.is_empty());
                if edge_busy {
                    thread::yield_now();
                } else {
                    thread::sleep(Duration::from_millis(1));
                }
            }
        })
    }

    fn start_pair() -> (WgTcpTunnel, Arc<AtomicBool>, JoinHandle<()>, SocketAddr) {
        let client_sk = random_key();
        let edge_sk = random_key();
        let client_pk = PublicKey::from(&StaticSecret::from(client_sk));
        let edge_pk = PublicKey::from(&StaticSecret::from(edge_sk));

        let edge_udp = UdpSocket::bind("127.0.0.1:0").unwrap();
        let edge_addr = edge_udp.local_addr().unwrap();
        drop(edge_udp);

        let stop = Arc::new(AtomicBool::new(false));
        let edge_join = spawn_edge_echo(
            edge_sk,
            client_pk.to_bytes(),
            edge_addr,
            Arc::clone(&stop),
        );
        thread::sleep(Duration::from_millis(30));

        let cfg = UserspacePeerConfig {
            private_key_b64: b64(&client_sk),
            peer_public_key_b64: b64(&edge_pk.to_bytes()),
            address: Ipv4Addr::new(10, 88, 89, 101),
            endpoint: edge_addr,
            dns: EDGE_IPV4,
            mtu: 1380,
            persistent_keepalive_secs: Some(25),
            allowed_ips: "10.88.89.1/32".into(),
        };
        let tunnel = WgTcpTunnel::start(&cfg).expect("start tunnel");
        assert!(tunnel.is_tcp_ready(), "engine must report ready after bind");
        (
            tunnel,
            stop,
            edge_join,
            SocketAddr::V4(SocketAddrV4::new(EDGE_IPV4, 443)),
        )
    }

    fn read_exact_timeout(stream: &mut TcpStream, buf: &mut [u8], overall: Duration) {
        stream.set_read_timeout(Some(Duration::from_millis(200))).ok();
        let deadline = Instant::now() + overall;
        let mut filled = 0;
        while filled < buf.len() {
            assert!(Instant::now() < deadline, "read timeout at {filled}");
            match stream.read(&mut buf[filled..]) {
                Ok(0) => panic!("EOF at {filled}"),
                Ok(n) => filled += n,
                Err(e) if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => panic!("read error: {e}"),
            }
        }
    }

    #[test]
    fn tcp_over_wg_loopback_echo() {
        let (tunnel, stop, edge_join, dest) = start_pair();
        let dialer = SmoltcpDialer::from_tunnel(&tunnel).expect("dialer");
        let mut stream = dialer.dial(dest).expect("dial through WG");
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .ok();
        stream.write_all(b"ping-w-transport").unwrap();
        let mut got = [0u8; 16];
        read_exact_timeout(&mut stream, &mut got, Duration::from_secs(10));
        assert_eq!(&got, b"ping-w-transport");
        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }

    /// Hold an Established SOCKS-like bridge idle: engine must not peg a core.
    /// Pre-fix busy-spin (bare `can_send` → poll 0) ran tens of thousands of
    /// iterations/sec; event-driven idle is gated by POLL_MAX_IDLE (~20/s).
    #[test]
    fn idle_established_engine_does_not_busy_spin() {
        let (tunnel, stop, edge_join, dest) = start_pair();
        let dialer = SmoltcpDialer::from_tunnel(&tunnel).expect("dialer");
        let _stream = dialer.dial(dest).expect("dial");
        thread::sleep(Duration::from_millis(300));
        let a = tunnel.counters().snapshot().engine_iterations;
        thread::sleep(Duration::from_secs(1));
        let b = tunnel.counters().snapshot().engine_iterations;
        let rate = b.saturating_sub(a);
        assert!(
            rate < 200,
            "idle engine iterations/sec too high: {rate} (busy-spin regression)"
        );
        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }

    #[test]
    fn tcp_over_wg_bulk_lossless_1mib() {
        let (tunnel, stop, edge_join, dest) = start_pair();
        let dialer = SmoltcpDialer::from_tunnel(&tunnel).expect("dialer");
        let mut stream = dialer.dial(dest).expect("dial");
        stream
            .set_write_timeout(Some(Duration::from_secs(60)))
            .ok();

        const N: usize = 1024 * 1024;
        let payload: Vec<u8> = (0..N).map(|i| (i % 251) as u8).collect();
        let writer = {
            let mut s = stream.try_clone().unwrap();
            let data = payload.clone();
            thread::spawn(move || {
                s.set_write_timeout(Some(Duration::from_secs(60))).ok();
                s.write_all(&data).expect("write bulk");
            })
        };
        let mut got = vec![0u8; N];
        read_exact_timeout(&mut stream, &mut got, Duration::from_secs(120));
        writer.join().unwrap();
        assert_eq!(got, payload, "bulk payload must be lossless");

        let snap = tunnel.counters().snapshot();
        assert!(snap.bytes_from_bridge > 0 || snap.bytes_to_bridge > 0);
        assert_eq!(snap.dropped_conns_backpressure, 0);

        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }

    /// Plan SLO lock: 100 MiB loopback echo without timeout / corruption.
    #[test]
    fn tcp_over_wg_bulk_lossless_100mib() {
        let (tunnel, stop, edge_join, dest) = start_pair();
        let dialer = SmoltcpDialer::from_tunnel(&tunnel).expect("dialer");
        let mut stream = dialer.dial(dest).expect("dial");
        stream
            .set_write_timeout(Some(Duration::from_secs(300)))
            .ok();

        const N: usize = 100 * 1024 * 1024;
        let payload: Vec<u8> = (0..N).map(|i| (i % 251) as u8).collect();
        let expect_hash = {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut h = DefaultHasher::new();
            payload.hash(&mut h);
            h.finish()
        };
        let writer = {
            let mut s = stream.try_clone().unwrap();
            let data = payload;
            thread::spawn(move || {
                s.set_write_timeout(Some(Duration::from_secs(300))).ok();
                s.write_all(&data).expect("write 100MiB");
            })
        };
        let mut got = vec![0u8; N];
        read_exact_timeout(&mut stream, &mut got, Duration::from_secs(600));
        writer.join().unwrap();
        let got_hash = {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut h = DefaultHasher::new();
            got.hash(&mut h);
            h.finish()
        };
        assert_eq!(got_hash, expect_hash, "100 MiB payload hash must match");
        assert_eq!(got.len(), N);

        let snap = tunnel.counters().snapshot();
        assert_eq!(snap.dropped_conns_backpressure, 0);

        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }

    #[test]
    fn tcp_over_wg_concurrent_dials() {
        let (tunnel, stop, edge_join, dest) = start_pair();
        let dialer = Arc::new(SmoltcpDialer::from_tunnel(&tunnel).expect("dialer"));
        let mut handles = Vec::new();
        for i in 0..6 {
            let d = Arc::clone(&dialer);
            handles.push(thread::spawn(move || {
                let mut stream = d.dial(dest).expect("dial");
                stream
                    .set_write_timeout(Some(Duration::from_secs(10)))
                    .ok();
                let msg = format!("c{i}-payload");
                stream.write_all(msg.as_bytes()).unwrap();
                let mut got = vec![0u8; msg.len()];
                read_exact_timeout(&mut stream, &mut got, Duration::from_secs(15));
                assert_eq!(&got, msg.as_bytes());
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }

    #[test]
    fn dialer_acl_fail_closed_without_isp() {
        let client_sk = random_key();
        let edge_sk = random_key();
        let edge_pk = PublicKey::from(&StaticSecret::from(edge_sk));
        let sink = UdpSocket::bind("127.0.0.1:0").unwrap();
        let endpoint = sink.local_addr().unwrap();
        let cfg = UserspacePeerConfig {
            private_key_b64: b64(&client_sk),
            peer_public_key_b64: b64(&edge_pk.to_bytes()),
            address: Ipv4Addr::new(10, 88, 89, 102),
            endpoint,
            dns: EDGE_IPV4,
            mtu: 1380,
            persistent_keepalive_secs: None,
            allowed_ips: "10.88.89.1/32".into(),
        };
        let tunnel = WgTcpTunnel::start(&cfg).unwrap();
        assert!(tunnel.is_tcp_ready());
        let dialer = SmoltcpDialer::from_tunnel(&tunnel).unwrap();
        let err = dialer
            .dial("1.1.1.1:443".parse().unwrap())
            .unwrap_err();
        assert!(err.contains("host_denied") || err.contains("outside"), "{err}");
        tunnel.stop();
    }

    #[test]
    fn engine_not_ready_after_stop() {
        let (tunnel, stop, edge_join, _) = start_pair();
        assert!(tunnel.is_tcp_ready());
        tunnel.stop();
        stop.store(true, Ordering::SeqCst);
        let _ = edge_join.join();
    }
}
