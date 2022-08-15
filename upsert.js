const {loadVectorGroups} = require("./src/common");
const {makePineconeClient} = require("./src/pinecone");

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

async function run(name, vectorFile, pineconeUrls) {
    const pinecones = {}
    for (let [metric, url] of pineconeUrls) {
        pinecones[metric] = makePineconeClient(pineconeApiKey, url)
    }

    const vectorGroups = await loadVectorGroups(vectorFile)

    for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
        for (let pinecone of Object.values(pinecones)) {
            await pinecone.upsert(sha, vectorGroup.same)
        }
        console.log(`${name}: Upserted: ${vectorGroup.file}`)
    }
}

(async () => {
    const start = Date.now()
    const goldbergPineconeUrls = {
        Cosine: "https://goldberg-544-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        DotProduct: "https://goldberg-544-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://goldberg-544-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Goldberg", "Goldberg-vectors.json", goldbergPineconeUrls)

    const pHashPineconeUrls = {
        Cosine: "https://phash-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://phash-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("pHash", "pHash-vectors-1660522856022.json", pHashPineconeUrls)

    const dctPineconeUrls = {
        Cosine: "https://dct-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://dct-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("DCT", "DCT-vectors-1660528334395.json", dctPineconeUrls)

    const intensityPineconeUrls = {
        Cosine: "https://intensity-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://intensity-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Intensity", "Intensity-vectors-1660521980204.json", intensityPineconeUrls)

    console.error(`Finished in ${Date.now() - start}ms`)
})()
