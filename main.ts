import { cborDecodeMulti } from "npm:@atproto/common"
import { CarReader } from "npm:@ipld/car/reader"
import { decode } from "npm:@ipld/dag-cbor"
import { MongoClient } from "npm:mongodb"

const BSKY_FIREHOSE_URL =
	"wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos"

const MONGO_URI = Deno.env.get("FIREBASE_API_KEY") as string

const client = new MongoClient(MONGO_URI)

const db = client.db("bsky")

const collection = db.collection("hashtags")

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

const hashtags = async ({ limit }: { limit: number } = { limit: 25 }) =>
	await collection
		.aggregate([
			{
				$group: {
					_id: "$hashtag",
					count: { $sum: 1 }
				}
			},
			{
				$project: {
					_id: 0,
					hashtag: "$_id",
					count: 1
				}
			},
			{
				$sort: { count: -1 }
			},
			{
				$limit: limit
			}
		])
		.toArray()

const handler = async (request: Request): Promise<Response> => {
	const popularHashtags = await hashtags()

	return new Response(JSON.stringify(popularHashtags), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	})
}

Deno.serve({ port: 80 }, handler)

// if (import.meta.main) {
// 	const ws = new WebSocket(BSKY_FIREHOSE_URL)
// 	ws.binaryType = 'arraybuffer'
// 	ws.onmessage = onMessage
//
// }
//
//
