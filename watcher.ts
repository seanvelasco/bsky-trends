import { cborDecodeMulti } from "npm:@atproto/common"
import { CarReader } from "npm:@ipld/car/reader"
import { decode } from "npm:@ipld/dag-cbor"
import { MongoClient, type Collection } from "npm:mongodb"

const MONGO_URI = Deno.env.get("MONGO_URI") as string
const BATCH_SIZE = 10
const BSKY_FIREHOSE_URL = "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos"

const messages: { hashtag: string, path: string, createdAt: Date }[] = []

const commit = async () => {
    if (messages.length <= 10) return

    const toInsert = messages.splice(0, BATCH_SIZE)

    const result = await collection.insertMany(toInsert)

    if (result.acknowledged) {
        console.log(`Inserted`, toInsert.map(({ hashtag }) => `#${hashtag}`).join(' '), `(${result.insertedCount})`)
    }
    else {
        console.error(result)
        messages.push(...toInsert)
    }
}

const onMessage = async ({ data }: MessageEvent<ArrayBuffer>) => {
    const [header, payload] = cborDecodeMulti(new Uint8Array(data)) as any
    if (header.op === 1 && header.t === "#commit" && payload) {
        for (const op of payload.ops) {
            if (op.action == "create") {
                const cr = await CarReader.fromBytes(payload.blocks)
                if (op.cid) {
                    const block = await cr.get(op.cid as any)
                    if (block) {
                        const message = decode(block.bytes) as any
                        if (
                            message.$type === "app.bsky.feed.post" &&
                            message.text &&
                            message?.facets
                        ) {
                            for (const facet of message.facets) {
                                for (const feature of facet?.features) {
                                    if (feature.tag) {
                                        messages.push({
                                            hashtag: feature.tag,
                                            path: op.path.toString(),
                                            createdAt: new Date(message.createdAt)
                                        })
                                    }
                                    if (messages.length >= BATCH_SIZE) await commit()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

let ws: WebSocket | null

let collection: Collection

const onError = (error: Event | ErrorEvent) => {
    console.error(error)
    if (ws) ws.close()
}

const onClose = () => {
    console.log('Connection closed')
    ws = null
    setTimeout(init, 5000)
}

const mongo = async () => {
    try {
        const client = new MongoClient(MONGO_URI)
        const db = client.db("bsky")
        collection = db.collection("hashtags")
    } catch (error) {
        console.error(error)
        await new Promise(resolve => setTimeout(resolve, 5000))
        await mongo()
    }
}

const init = async () => {
    await mongo()
    ws = new WebSocket(BSKY_FIREHOSE_URL)
    ws.binaryType = 'arraybuffer'
    ws.onmessage = onMessage
    ws.onerror = onError
    ws.onclose = onClose
    ws.onopen = () => console.log('Connection opened')
}

await init()