const {loadVectorGroups} = require("./src/common");
const {makePineconeClient} = require("./src/pinecone");

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

async function run(pineconeUrls, vectorFile) {
    const start = Date.now()
    const pinecones = {
        Cosine: makePineconeClient(pineconeApiKey, pineconeUrls.Cosine),
        Euclidean: makePineconeClient(pineconeApiKey, pineconeUrls.Euclidean),
        DotProduct: makePineconeClient(pineconeApiKey, pineconeUrls.DotProduct)
    }
    const vectorGroups = loadVectorGroups(vectorFile)

    const promises = []
    for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
        promises.push((async () => {
            const results = await Promise.all(Object.values(pinecones).map(pc => pc.upsert(sha, vectorGroup.same)))
            console.log(`Upserted: ${vectorGroup.file}`)
            return results.reduce((a, b) => a && b, true)
        })())
    }
    const inserted = await Promise.all(promises)

    console.log(`Inserted all,${inserted.reduce((a, b) => a && b, true)}`)
    console.log(`Finished in ${Date.now() - start}ms`)
}

const pineconeUrls = {
    Cosine: "https://goldberg-544-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
    DotProduct: "https://goldberg-544-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
    Euclidean: "https://goldberg-544-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
}

await run("", pineconeUrls)