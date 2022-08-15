const {makePineconeClient} = require("./src/pinecone")
const {loadVectorGroups, outputResultCSV} = require("./src/common");

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

async function getResults(name, pinecone, metric, vectorGroups) {
    const highestScore = [];
    const allScores = [];

    let numQueried = 0;
    const toQuery = Object.keys(vectorGroups).length
    for (const vectorGroup of Object.values(vectorGroups)) {
        const results = await pinecone.query(vectorGroup.same, 10);
        if (results && results.length > 0) {
            highestScore.push(results[0].score)
            results.forEach(result => allScores.push(result.score))
        }

        numQueried++
        console.error(`Queried ${metric} for ${numQueried}/${toQuery}`)
    }

    highestScore.sort((a, b) => a - b)
    allScores.sort((a, b) => a - b)

    console.log("Similarity Function,Distance Metric")
    console.log(`${name},${metric}`)
    console.log()

    console.log("Category,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
    outputResultCSV("Missing - Highest Score", highestScore)
    outputResultCSV("Missing - All Scores", allScores)
}

async function run(name, vectorFile, pineconeUrls) {
    const pinecones = {}
    for (let [metric, url] of Object.entries(pineconeUrls)) {
        pinecones[metric] = makePineconeClient(pineconeApiKey, url)
    }

    const vectorGroups = await loadVectorGroups(vectorFile)

    for (let [metric, pinecone] of Object.entries(pinecones)) {
        await getResults(name, pinecone, metric, vectorGroups)
    }
}

(async () => {
    const start = Date.now()
    const goldbergPineconeUrls = {
        Cosine: "https://goldberg-544-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        DotProduct: "https://goldberg-544-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://goldberg-544-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Goldberg", "", goldbergPineconeUrls)

    const pHashPineconeUrls = {
        Cosine: "https://phash-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://phash-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("pHash", "", pHashPineconeUrls)

    const dctPineconeUrls = {
        Cosine: "https://dct-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://dct-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("DCT", "", dctPineconeUrls)

    const intensityPineconeUrls = {
        Cosine: "https://intensity-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://intensity-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Intensity", "", intensityPineconeUrls)

    console.error(`Finished in ${Date.now() - start}ms`)
})()

