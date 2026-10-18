/// 设备 / Device capability shared by sensors and actuators.
pub trait Device {
    /// Stable device id.
    fn id(&self) -> &str;

    /// 读取 / Read the current sample or commanded position.
    fn read(&self) -> i32;

    /// 写入 / Write a setpoint. Sensors may ignore it.
    fn write(&mut self, value: i32);
}
