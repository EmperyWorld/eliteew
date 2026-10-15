// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Rust-owned one-shot authorization state for update, reset, and restart actions.
// Invariants:
// - Update/reset tickets are short-lived and consumed exactly once.
// - Restart is allowed only after a successful native action records a reason.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
// ---

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const ACTION_TICKET_TTL_SECS: u64 = 15 * 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateTicket {
    pub id: String,
    pub version: String,
    issued_at: u64,
}

#[derive(Debug, Clone)]
struct ResetTicket {
    id: String,
    issued_at: u64,
}

#[derive(Debug, Default)]
struct ActionTicketState {
    update: Option<UpdateTicket>,
    reset: Option<ResetTicket>,
    restart_reason: Option<String>,
}

#[derive(Debug, Default)]
pub struct ActionTickets {
    inner: Mutex<ActionTicketState>,
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn new_ticket_id(prefix: &str) -> Result<String, String> {
    let mut bytes = [0u8; 24];
    getrandom::fill(&mut bytes).map_err(|error| format!("ticket_random: {error}"))?;
    Ok(format!("{prefix}_{}", hex::encode(bytes)))
}

fn expired(issued_at: u64) -> bool {
    now_unix().saturating_sub(issued_at) > ACTION_TICKET_TTL_SECS
}

impl ActionTickets {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, ActionTicketState>, String> {
        self.inner
            .lock()
            .map_err(|_| "action_ticket_state_poisoned".to_string())
    }

    pub fn issue_update_ticket(&self, version: &str) -> Result<String, String> {
        let id = new_ticket_id("update")?;
        self.lock()?.update = Some(UpdateTicket {
            id: id.clone(),
            version: version.trim().to_string(),
            issued_at: now_unix(),
        });
        Ok(id)
    }

    pub fn clear_update_ticket(&self) -> Result<(), String> {
        self.lock()?.update = None;
        Ok(())
    }

    pub fn consume_update_ticket(&self) -> Result<UpdateTicket, String> {
        let Some(ticket) = self.lock()?.update.take() else {
            return Err("update_ticket_required".into());
        };
        if expired(ticket.issued_at) {
            return Err("update_ticket_expired".into());
        }
        Ok(ticket)
    }

    pub fn issue_reset_ticket(&self) -> Result<String, String> {
        let id = new_ticket_id("reset")?;
        self.lock()?.reset = Some(ResetTicket {
            id: id.clone(),
            issued_at: now_unix(),
        });
        Ok(id)
    }

    pub fn consume_reset_ticket(&self, confirmation_token: &str) -> Result<(), String> {
        let mut state = self.lock()?;
        let Some(ticket) = state.reset.as_ref() else {
            return Err("reset_ticket_required".into());
        };
        if expired(ticket.issued_at) {
            state.reset = None;
            return Err("reset_ticket_expired".into());
        }
        if ticket.id != confirmation_token.trim() {
            return Err("reset_ticket_invalid".into());
        }
        state.reset = None;
        Ok(())
    }

    pub fn issue_restart_ticket(&self, reason: &str) -> Result<(), String> {
        let reason = reason.trim();
        if reason.is_empty() {
            return Err("restart_reason_required".into());
        }
        self.lock()?.restart_reason = Some(reason.to_string());
        Ok(())
    }

    pub fn consume_restart_ticket(&self) -> Result<String, String> {
        self.lock()?
            .restart_reason
            .take()
            .ok_or_else(|| "restart_ticket_required".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::ActionTickets;

    #[test]
    fn update_ticket_is_one_shot() {
        let tickets = ActionTickets::default();
        let id = tickets.issue_update_ticket("1.2.3").expect("issue");
        let consumed = tickets.consume_update_ticket().expect("consume");
        assert_eq!(consumed.id, id);
        assert_eq!(consumed.version, "1.2.3");
        assert_eq!(
            tickets.consume_update_ticket().unwrap_err(),
            "update_ticket_required"
        );
    }

    #[test]
    fn reset_ticket_rejects_wrong_token_and_consumes_match() {
        let tickets = ActionTickets::default();
        let token = tickets.issue_reset_ticket().expect("issue");
        assert_eq!(
            tickets.consume_reset_ticket("wrong").unwrap_err(),
            "reset_ticket_invalid"
        );
        tickets.consume_reset_ticket(&token).expect("consume");
        assert_eq!(
            tickets.consume_reset_ticket(&token).unwrap_err(),
            "reset_ticket_required"
        );
    }

    #[test]
    fn restart_requires_a_recorded_reason_and_is_one_shot() {
        let tickets = ActionTickets::default();
        assert_eq!(
            tickets.consume_restart_ticket().unwrap_err(),
            "restart_ticket_required"
        );
        tickets
            .issue_restart_ticket("update_installed")
            .expect("issue");
        assert_eq!(
            tickets.consume_restart_ticket().expect("consume"),
            "update_installed"
        );
        assert!(tickets.consume_restart_ticket().is_err());
    }
}
