use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;
use std::io::{self, Write};
use zeroize::Zeroizing;

// Installer palette v2 cyan/metal (console step 10).
const BANNER: &str = "\x1b[38;2;10;12;14m\x1b[48;2;46;196;198m EmpiierOS \x1b[0m\x1b[38;2;232;238;242m  ключ восстановления диска\x1b[0m\r\n\
\x1b[38;2;139;151;163mНе PIN. Не ключ сети. Только LUKS state тома данных.\x1b[0m\r\n";
const PROMPT: &str = "\x1b[38;2;46;196;198m> \x1b[0m";

pub fn read_passphrase_masked() -> io::Result<Zeroizing<String>> {
    let mut stdout = io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    enable_raw_mode()?;
    let result = read_passphrase_inner();
    disable_raw_mode()?;
    stdout.execute(LeaveAlternateScreen)?;
    result
}

fn read_passphrase_inner() -> io::Result<Zeroizing<String>> {
    let mut stdout = io::stdout();
    write!(stdout, "\r\n{BANNER}{PROMPT}")?;
    stdout.flush()?;

    let mut buf = Zeroizing::new(String::new());
    loop {
        if let Event::Key(KeyEvent {
            code,
            modifiers,
            ..
        }) = event::read()?
        {
            match code {
                KeyCode::Enter => {
                    writeln!(stdout)?;
                    stdout.flush()?;
                    break;
                }
                KeyCode::Char('c') if modifiers.contains(KeyModifiers::CONTROL) => {
                    buf.clear();
                    writeln!(stdout, "\r\n[отмена]")?;
                    stdout.flush()?;
                    break;
                }
                KeyCode::Backspace => {
                    buf.pop();
                }
                KeyCode::Char(ch) => {
                    buf.push(ch);
                    write!(stdout, "*")?;
                    stdout.flush()?;
                }
                _ => {}
            }
        }
    }
    Ok(buf)
}
