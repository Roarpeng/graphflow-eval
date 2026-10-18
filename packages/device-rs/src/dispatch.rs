use crate::actuator::Actuator;
use crate::device::Device;
use crate::sensor::Sensor;

/// `&dyn Device` receiver. Resolves to the trait method `Device::read`.
pub fn poll_reading(device: &dyn Device) -> i32 {
    device.read()
}

/// `impl Device` receiver. Also resolves to the trait method `Device::read`.
pub fn describe(device: impl Device) -> String {
    format!("{}={}", device.id(), device.read())
}

/// Concrete `&Sensor` receiver. Resolves to `Sensor`'s impl of `read`.
pub fn sensor_reading(sensor: &Sensor) -> i32 {
    sensor.read()
}

/// Concrete `&Actuator` receiver. Resolves to `Actuator`'s impl of `read`.
pub fn actuator_reading(actuator: &Actuator) -> i32 {
    actuator.read()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dyn_and_impl_trait_read_through_the_trait() {
        let sensor = Sensor::new("temp", 21);
        assert_eq!(poll_reading(&sensor), 21);
        assert_eq!(describe(sensor), "temp=21");
    }

    #[test]
    fn concrete_receivers_stay_on_their_impls() {
        let mut actuator = Actuator::new("valve", 0);
        actuator.write(7);
        assert_eq!(actuator_reading(&actuator), 7);
        assert_eq!(sensor_reading(&Sensor::new("temp", 21)), 21);
    }
}
