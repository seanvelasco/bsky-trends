import { MongoClient } from "npm:mongodb"

const MONGO_URI = Deno.env.get("MONGO_URI") as string

const client = new MongoClient(MONGO_URI)

const db = client.db("bsky")

const collection = db.collection("hashtags")

const hashtags = async ({ limit }: { limit: number } = { limit: 25 }) => {
	const pipeline = [
		{
			$group: {
				_id: "$hashtag",
				count: { $sum: 1 },
			},
		},
		{
			$project: {
				_id: 0,
				hashtag: "$_id",
				count: 1,
			},
		},
		{
			$sort: { count: -1 },
		},
		{
			$limit: limit,
		},
	]

	return await collection
		.aggregate(pipeline)
		.toArray()
}

const handler = async (req: Request): Promise<Response> => {
	const url = new URL(req.url)

	const limit = Number(url.searchParams.get("limit") || 25)

	const headers = new Headers({
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, OPTIONS",
		"Access-Control-Allow-Headers":
			"Origin, X-Requested-With, Content-Type, Accept",
	})

	const data = await hashtags({ limit })

	if (!data) {
		return new Response(null, {
			status: 400,
		})

	}

	return new Response(JSON.stringify(data), {
		status: 200,
		headers,
	})
}

Deno.serve({ port: 80 }, handler)
