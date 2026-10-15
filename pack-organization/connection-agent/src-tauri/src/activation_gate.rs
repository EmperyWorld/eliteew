// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Process-local mutex so USB Capsule import and Air enrollment cannot race.
// Invariants:
// - USB may preempt Air only before the auth frame (Connecting).
// - After Air Claimed, USB waits / fails closed until Air releases.
// - Lease generation prevents a preempted Air Drop from clearing a newer owner.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md §6
// ---

use std::sync::{Mutex, MutexGuard};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationOwner {
    Idle,
    Usb,
    /// Connected / parsing; USB may replace this slot.
    AirConnecting,
    /// Auth accepted / Capsule in flight; USB must wait.
    AirClaimed,
}

struct GateState {
    owner: ActivationOwner,
    generation: u64,
}

static GATE: Mutex<GateState> = Mutex::new(GateState {
    owner: ActivationOwner::Idle,
    generation: 0,
});

fn lock() -> Result<MutexGuard<'static, GateState>, String> {
    GATE.lock().map_err(|_| "activation_gate_poisoned".into())
}

#[derive(Debug)]
pub struct ActivationLease {
    owner: ActivationOwner,
    generation: u64,
}

impl ActivationLease {
    pub fn mark_air_claimed(&self) -> Result<(), String> {
        if self.owner != ActivationOwner::AirConnecting
            && self.owner != ActivationOwner::AirClaimed
        {
            return Err("activation_gate_not_air".into());
        }
        let mut state = lock()?;
        if state.generation != self.generation {
            return Err("activation_gate_preempted".into());
        }
        if state.owner != ActivationOwner::AirConnecting
            && state.owner != ActivationOwner::AirClaimed
        {
            return Err("activation_gate_lost".into());
        }
        state.owner = ActivationOwner::AirClaimed;
        Ok(())
    }
}

impl Drop for ActivationLease {
    fn drop(&mut self) {
        if let Ok(mut state) = GATE.lock() {
            if state.generation == self.generation {
                state.owner = ActivationOwner::Idle;
            }
        }
    }
}

/// Begin USB import. Preempts AirConnecting; denies AirClaimed.
pub fn begin_usb() -> Result<ActivationLease, String> {
    let mut state = lock()?;
    match state.owner {
        ActivationOwner::Idle | ActivationOwner::AirConnecting => {
            state.generation = state.generation.wrapping_add(1);
            state.owner = ActivationOwner::Usb;
            Ok(ActivationLease {
                owner: ActivationOwner::Usb,
                generation: state.generation,
            })
        }
        ActivationOwner::Usb => Err("usb_import_busy".into()),
        ActivationOwner::AirClaimed => Err("air_enroll_in_progress".into()),
    }
}

/// Begin Air exchange.
pub fn begin_air() -> Result<ActivationLease, String> {
    let mut state = lock()?;
    match state.owner {
        ActivationOwner::Idle => {
            state.generation = state.generation.wrapping_add(1);
            state.owner = ActivationOwner::AirConnecting;
            Ok(ActivationLease {
                owner: ActivationOwner::AirConnecting,
                generation: state.generation,
            })
        }
        ActivationOwner::Usb => Err("usb_import_busy".into()),
        ActivationOwner::AirConnecting => Err("air_enroll_busy".into()),
        ActivationOwner::AirClaimed => Err("air_enroll_in_progress".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usb_preempts_air_connecting_but_not_claimed() {
        let air = begin_air().expect("air");
        let usb = begin_usb().expect("usb preempt");
        drop(air); // preempted generation — must not clear Usb
        assert!(begin_air().is_err());
        drop(usb);

        let air = begin_air().expect("air2");
        air.mark_air_claimed().expect("claim");
        assert_eq!(
            begin_usb().unwrap_err(),
            "air_enroll_in_progress".to_string()
        );
        drop(air);
        let _usb = begin_usb().expect("usb after release");
    }
}
