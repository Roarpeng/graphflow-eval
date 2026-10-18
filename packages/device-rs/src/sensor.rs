use crate::device::Device;

/// Read-only probe. `read` returns the last sample.
pub struct Sensor {
    pub name: String,
    pub reading: i32,
}

impl Sensor {
    pub fn new(name: impl Into<String>, reading: i32) -> Self {
        Self {
            name: name.into(),
            reading,
        }
    }
}

impl Device for Sensor {
    fn id(&self) -> &str {
        &self.name
    }

    fn read(&self) -> i32 {
        self.reading
    }

    fn write(&mut self, _value: i32) {
        // A sensor does not accept a setpoint.
    }
}
