Image Matching Algorithms For Use With KNN Search
=================================================

As part of the development of [alt-text.org](https://alt-text.org), it's necessary to perform large-scale
fuzzy matching of images. To accomplish this, we leverage the Pinecone.io
vector database which offers k-nearest-neighbor searches over feature vectors.
While there's been much publicly available research on image similarity algorithms
which use hamming distance comparison algorithms, we found little on leveraging 
KNN searches with non-ML based vector production.

We tested 4 algorithms: 1024 pixel pHash, 1024 frequency discrete cosine transform,
1024 pixel intensity, and the algorithm proposed in 
[this paper](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.104.2585&rep=rep1&type=pdf)
by Wong, Bern, and Goldberg which results in feature vectors of 544 values.

Pinecone offers 3 distance metrics for measuring vector adjacency: Cosine, Dot Product,
and Euclidean. While we had good reason to believe that Cosine was the only appropriate
metric for the aforementioned algorithms, we decided to test all three for each
algorithm in case we were mistaken. When returning results Pinecone scores each match, with the range depending
on the metric used, and allows setting the max number to return.

We performed our tests using the first 10,000 JPEG images in the `train_50k_0.zip` file from a
past Meta image matching competition which can be found
[here](https://ai.facebook.com/datasets/disc21-downloads/). The next 2,000 images were used for measuring performance
when the requested image is not in the database.

For the [alt-text.org](https://alt-text.org) use case, we're primarily interested in matching
almost identical images. Several cases were of particular interest: larger, smaller, cropped,
and in a different image format.

The choice of JavaScript was forced by the existing codebase, including all the matching algorithm options,
already being in the language. The single-threaded nature of JavaScript was a major disadvantage and contributed
to very long runtimes, but opting for a better suited language would mean a full rewrite of the 
[alt-text.org](https://alt-text.org) backend.

We ran an initial round of tests collecting information only on whether the top match was correct and the count of 
matches with a score over some value. Examining our findings it quickly became clear that we had misunderstood the 
score field of returned matches, believing that it would be in [0, 1] for all metrics, which was only the case for
Cosine. These initial results did however make it apparent that the Dot Product metric was not appropriate for any 
algorithm except possibly Goldberg,  so it was omitted for other algorithms in the second round of tests. The Euclidean
distance metric performed decently, but had significant issues matching identical images. For lack of time, we chose to
drop it as well for all algorithms. While the results from the first round did not directly influence our findings, 
the raw data is available in a Google sheet linked below.


Process
-------

1. [process-images.js](process-images.js): For each image, compute and save to disk versions 2x size, 1/2x size,
   with a 5% border crop, and in PNG format. We use the Node.js `canvas` library for this, which wraps 
   the `Cairo` open source image processing library.
2. [vectorize.js](vectorize.js): For each matching algorithm, compute the feature vector for each image and
   all its alterations, as well as the SHA256 hash of the original image, then store the result in a large JSON 
   blob on disk.
3. [vectorize-missing.js](vectorize-missing.js): Compute and save to disk vectors for a smaller set of images. These 
   will be searched for but not inserted.
4. [upsert.js](upsert.js): Upsert a record to Pinecone for only the vector for the original image, with the image hash
   as the stored value.
5. [query-matching.js](query-matching.js): For each image and all its alterations, perform a KNN query, recording
   the metrics discussed below, and then print a summary of the findings in CSV format.
6. [query-missing.js](query-missing.js): For each missing image, perform a KNN query, recording the tops score and the
   total set of scores.


Goals
-----

Three things were of interest for each algorithm:

- Vector computation time 
- Whether the correct record was the top result for each image and all its alterations
- How reliably non-matching results could be excluded


Result Format
-------------

The following results for a given `(algorithm, distance metric)` are recorded:

1. Vector computation time: average, min, max, and percentiles
2. What percent of the time was the correct image the top result
3. What percent of the time was the correct image present in results
4. The score of the matching image if found: average, min, max, and percentiles
5. The score of the highest non-matching image: average, min, max, and percentiles

Findings
--------

**Goldberg - Cosine**
- Goldberg with a Dot Product metric consistently fared the worst at almost all measures, and could be excluded
  from further consideration
- Algorithm to compute is complex and the implementation available is more so
- The slowest to compute by several orders of magnitude, but the tested implementation may be significantly optimizable
- The least reliable for all but cropped images, which are the least important, but the difference was 
  mostly within tolerance
- The largest and most reliable difference between matching and non-matching, with a score of 0.6 appearing to be a
  reasonably reliable cutoff which accords with the source paper

**Discrete Cosine Transform - Cosine**
- Compute second slowest, but still very fast
- Perfect correctness for all but cropped images, where it's still very reliable
- No clear choice of a score that would reliably include non-exact matches while excluding others

**Intensity - Cosine**
- Computation quickest and simplest to understand
- Excellent at matching all but cropped images
- No clear choice of a score that would reliably include non-exact matches while excluding others

**pHash - Cosine**
- Computation quick and simple to understand
- Excellent at matching all but cropped images
- No clear choice of a score that would reliably include non-exact matches while excluding others

**Conclusion**
Based on the findings above, we will endeavor to optimize Goldberg and determine if performance is acceptable. If it is
not, we may still opt to use it. Other algorithms fall down hard on the key question of separating altered but matching 
images from searches returning no similar results.

Data Availability
-----------------

Raw results are available in
[this Google sheet](https://docs.google.com/spreadsheets/d/12rxQ4aJhzthBLZ1Z9JEANVloY3u8_rjWPbfIHfQz3Ms/edit?usp=sharing)

The vast bulk of the runtime for this process is spent computing feature vectors, if you would like to test other KNN
query engines, the precomputed vectors are available upon request.

Raw results from the first round of tests are available in
[this Google sheet](https://docs.google.com/spreadsheets/d/1Q2TXNwPgB-awFmWzeXYXX21OUVjkt0BU0ldPdtRdxTo/edit?usp=sharing).


Future Work
-----------

- Testing additional algorithms
  - Would Goldberg perform better or worse with a wider lightness scale? 
- Testing images with a watermark or text added
