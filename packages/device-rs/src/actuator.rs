use crate::device::Device;

/// Output device. `read` returns the last commanded position.
pub struct Actuator {
    pub name: String,
    pub position: i32,
}

impl Actuator {
    pub fn new(name: impl Into<String>, position: i32) -> Self {
        Self {
            name: name.into(),
            position,
        }
    }
}

impl Device for Actuator {
    fn id(&self) -> &str {
        &self.name
    }

    fn read(&self) -> i32 {
        self.position
    }

    fn write(&mut self, value: i32) {
        self.position = value;
    }
}
