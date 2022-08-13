const fetch = require("node-fetch");

function makeClient(apiKey, url) {
    return {
        upsert: upserter(apiKey, `${url}/vectors/upsert`, "alt"),
        query: queryer(apiKey, `${url}/query`, "alt")
    };
}

function upserter(apiKey, url, namespace) {
    return async (sha256, vector) => {
        const payload = {
            vectors: [
                {
                    id: sha256,
                    values: vector,
                },
            ],
            namespace: namespace,
        };

        const resp = await fetch(
            url,
            {
                method: "POST",
                headers: {
                    "Api-Key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        ).catch((err) => {
            console.log(err);
            return null;
        });

        if (resp) {
            if (resp.ok) {
                return true
            } else {
                // console.log(`Failed to save alt text text for ${sha256}: ${resp.status} - ${await resp.text()}`)
                return false
            }
        } else {
            return false
        }
    };
}

function queryer(apiKey, url, namespace) {
    return async (vector, maxResults) => {
        const payload = {
            namespace: namespace,
            topK: maxResults,
            vector: vector,
        };

        const resp = await fetch(
            url,
            {
                method: "POST",
                headers: {
                    "Api-Key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        ).catch((err) => {
            console.log(err);
            return null;
        });

        if (!resp) {
            throw new Error("Fetch errored.");
        } else if (!resp.ok) {
            throw new Error(
                `Got non-ok response from Pinecone /query endpoint: ${
                    resp.status
                }: Body: '${await resp.text()}'`
            );
        }

        const body = await resp.json();

        if (!body.matches) {
            throw new Error(`Malformed response body: ${JSON.stringify(body)}`);
        }

        return body.matches.map((match) => {
            return {
                sha256: match.id,
                score: match.score,
            };
        });
    };
}

exports.makePineconeClient = makeClient;
