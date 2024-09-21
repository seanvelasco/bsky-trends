# bsky-trends

This API powers [usky.app/trends](https://usky.app/trends) to display most frequently used #hashtags in Bluesky in the last 48 hours.

## How it works

Hashtag keywords are inserted to MongoDB as time-series data. Documents in the collection have a set time to live (TTL). When TTL is reached, the documents are removed from the collection.

```javascript
await collection.insertMany([
	{
		hashtag: feature.tag,
		path: op.path.toString(),
		createdAt: new Date(message.createdAt)
	}
])
```

To retrieve the trending hashtags, a two-part MongoDB is used to count each instances of the hashtags and sort them by the highest count

Coung

```javascript
{
    // Group documents by hashtag
    // Each unique hashtag is its own group
    $group: {
        _id: "$hashtag", // $group requires _id, set _id to the hashtag value
        count: { $sum: 1 }, // count is calculated by adding 1 each occurence
    }
}
```

```javascript
// Reshape the output so we have hashtag instead of _id
{
	$project: {
		_id: 0, // Exclude _id
		hashtag: "$_id", // Include hashtag with _id as its value
		count: 1, // Include count
	},
}
```

```javascript
{
    $sort: { count: -1 }, // sort by descending order, 1 is ascending and -1 is descending
},
{
    $limit: limit, // how many results to return
}

```

## Usage

Use this in your own web app or service!

```
https://trends.usky.app?limit=100
```
