mcp server set up cursor

Use `calculateCentroid` when aligning overlapping batches in incremental t-SNE/UMAP, centering clusters for visualization, or normalizing offsets in dynamic layouts. Not needed for PCA since it preserves global structure.

use simple dimensionality reduction as fourth algo to compare to. A naïve downsampling method that reduces dimensionality by uniformly averaging non-overlapping groups of input dimensions, assuming equal contribution.

for development now i only need the public folder and the server and caddy file and less functions in db. the projection file is not used in the frontend.

i ll remove the projection file for now and streamline the db in order to implement ark type and type script

migration to typescript introduced lots of bloat and is done via auto code gen
