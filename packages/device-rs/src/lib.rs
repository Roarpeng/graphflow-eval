//! Device abstraction fixture.
//! Trait methods, `dyn Device`, `impl Device`, and concrete receivers live in
//! separate modules so a read/blast can tell them apart.

mod actuator;
mod device;
mod dispatch;
mod sensor;

pub use actuator::Actuator;
pub use device::Device;
pub use dispatch::{actuator_reading, describe, poll_reading, sensor_reading};
pub use sensor::Sensor;
