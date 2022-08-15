Image Matching Algorithms For Use With KNN Search
=================================================

As part of the development of [alt-text.org](https://alt-text.org), it's necessary to perform large-scale
fuzzy matching of images. To accomplish this, we leverage the Pinecone.io
vector database which offers k-nearest-neighbor searches over feature vectors.
While there's been much publicly available research on image similarity algorithms
which use hamming distance comparison algorithms, we found little on leveraging 
KNN searches, whose easy widespread availability is relatively new.

We tested 4 algorithms: 1024 pixel pHash, 1024 frequency discrete cosine transform,
1024 pixel intensity, and the algorithm proposed in 
[this paper](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.104.2585&rep=rep1&type=pdf)
by Wong, Bern, and Goldberg which results in feature vectors of 544 values.

Pinecone offers 3 distance metrics for measuring vector adjacency: Cosine, Dot Product,
and Euclidean. While we had good reason to believe that Cosine was the only appropriate
metric for the aforementioned algorithms, we decided to test all three for each
algorithm in case we were mistaken. When returning results, Pinecone scores each match
in (0,1], with 1 indicating a perfect match, and allows setting the max number to return.

We performed our tests using the first 10,000 JPEG images in the `train_50k_0.zip` file from a
past Meta image matching competition which can be found
[here](https://ai.facebook.com/datasets/disc21-downloads/).

For the [alt-text.org](https://alt-text.org) use case, we're primarily interested in matching
almost identical images. Several cases were of particular interest: larger, smaller, cropped,
and in a different image format.

The choice of JavaScript was forced by the existing codebase, including all the matching algorithm options,
already being in the language. The single-threaded nature of JavaScript was a major disadvantage and contributed
to very long runtimes, but opting for a better suited language would mean a full rewrite of the 
[alt-text.org](https://alt-text.org) backend.


Process
-------

1. [process-images.js](process-images.js): For each image, compute and save to disk versions 2x size, 1/2x size,
   with a 5% border crop, and in PNG format. We use the Node.js `canvas` library for this, which wraps 
   the `Cairo` open source image processing library.
2. [vectorize.js](vectorize.js): For each matching algorithm, compute the feature vector for each image and
   all its alterations, as well as the SHA256 hash of the original image, then store the result in a large JSON 
   blob on disk.
3. [upsert.js](upsert.js): Upsert a record to Pinecone for only the vector for the original image, with the image hash
   as the stored value.
4. [query-and-finish.js](query-and-finish.js): For each image and all its alterations, perform a KNN query, recording
   the metrics discussed below, and then print a summary of the findings in CSV format.


Goals
-----

Three metrics were of interest for each algorithm:

- Vector computation time 
- Whether the correct record was the top result for each image and all its alterations
- What score threshold would result in the fewest false positives without also excluding correct results


Result Format
-------------

Results for a given `(algorithm, distance metric)` are in three parts, one for each of the metrics listed above.

1. What percent of the time was the correct image the top result
2. Vector computation time: average, min, max, and percentiles
3. The count of results for each `(original image or alteration, score threshold)`: average, min, max, and percentiles


Findings
--------

Raw results are available in 
[this Google sheet](https://docs.google.com/spreadsheets/d/1Q2TXNwPgB-awFmWzeXYXX21OUVjkt0BU0ldPdtRdxTo/edit?usp=sharing).

The vast bulk of the runtime for this process is spent computing feature vectors, if you would like to test other KNN
query engines, the precomputed 

Future Work
-----------

1. Testing additional algorithms
2. When the correct image was not the top result, we did not check whether it appeared lower in the results