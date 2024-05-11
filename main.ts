import { MongoClient } from "npm:mongodb"
import { config } from 'https://deno.land/x/dotenv/mod.ts'

await config({ export: true })

const MONGO_URI = Deno.env.get("MONGO_URI") as string

const client = new MongoClient(MONGO_URI)

const db = client.db("bsky")

const collection = db.collection("hashtags")

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

const handler = async (_: Request): Promise<Response> => {
	const popularHashtags = await hashtags()

	const headers = new Headers(
		{
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
		}
	)

	return new Response(JSON.stringify(popularHashtags), {
		status: 200,
		headers
	})
}



Deno.serve({ port: 80 }, handler)