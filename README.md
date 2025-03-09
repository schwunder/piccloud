mcp server set up cursor

Use `calculateCentroid` when aligning overlapping batches in incremental t-SNE/UMAP, centering clusters for visualization, or normalizing offsets in dynamic layouts. Not needed for PCA since it preserves global structure.

use simple dimensionality reduction as fourth algo to compare to. A naïve downsampling method that reduces dimensionality by uniformly averaging non-overlapping groups of input dimensions, assuming equal contribution.

for development now i only need the public folder and the server and caddy file and less functions in db. the projection file is not used in the frontend.

i ll remove the projection file for now and streamline the db in order to implement ark type and type script

PRAGMA query_only = ON;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -2000;

db opti

Inter-cluster Spacing:
Large gaps between clusters (e.g., ~20-35 units)
Example: From (-4, -43) to (-40, -4) is a significant distance
This helps maintain clear visual separation between groups the gaps should not be that large. as well Outlier cluster: One point at (13.4, -38.0) bridigng here. meaning more neighbours and more focus on neigbouhrs. and maybe more agressive learning and even more epochs.

the spread could actually be lover it does not effect overlapping really

also what is tranfsform size queue


offscreen canvas only more perfomant with worker threads