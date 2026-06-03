import { createServer } from 'node:net'
import { Aedes } from 'aedes'
const aedes = await Aedes.createBroker()
const server = createServer(aedes.handle)
server.listen(1883, () => console.log('[broker] mqtt listening on 1883'))
let msgs = 0
aedes.on('publish', (p) => {
  if (p.topic && p.topic.startsWith('fk/')) {
    msgs++
    if (msgs % 200 === 0) console.log('[broker] forwarded', msgs, 'fk msgs')
  }
})
