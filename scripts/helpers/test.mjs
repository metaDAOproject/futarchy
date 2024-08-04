import { createHelia } from 'helia'
import { json } from '@helia/json'

async function main() {
    const helia = await createHelia()
    const j = json(helia)

    const myImmutableAddress = await j.add({ hello: 'world' })

    console.log(`CID: https://ipfs.io/ipfs/${myImmutableAddress}`);
    console.log(await j.get(myImmutableAddress))
}

main()
