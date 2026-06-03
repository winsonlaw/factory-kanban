/**
 * 可选依赖 modbus-serial 的最小类型声明 —— 仅 modbus 模式需要，按需 `npm i modbus-serial`。
 * 声明它让 TS 在不安装该包时也能编译（运行时动态 import）。
 */
declare module 'modbus-serial' {
  export default class ModbusRTU {
    connectTCP(host: string, options: { port: number }): Promise<void>
    setID(id: number): void
    readHoldingRegisters(addr: number, length: number): Promise<{ data: number[] }>
    close(cb?: () => void): void
  }
}
