import { cborDecodeMulti } from "npm:@atproto/common"
import { CarReader } from "npm:@ipld/car/reader"
import { decode } from "npm:@ipld/dag-cbor"
import { MongoClient } from "npm:mongodb"
import { config } from 'https://deno.land/x/dotenv/mod.ts'

await config({ export: true })

const MONGO_URI = Deno.env.get("MONGO_URI") as string

const client = new MongoClient(MONGO_URI)

const db = client.db("bsky")

const collection = db.collection("hashtags")

const BSKY_FIREHOSE_URL =
    "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos"

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
                                    const hashtag = feature.tag as string
                                    if (hashtag) {
                                        collection.insertOne({
                                            hashtag,
                                            postedAt: new Date(
                                                message.createdAt
                                            )
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

const ws = new WebSocket(BSKY_FIREHOSE_URL)
ws.binaryType = 'arraybuffer'
ws.onmessage = onMessage