mcp server set up cursor

Use `calculateCentroid` when aligning overlapping batches in incremental t-SNE/UMAP, centering clusters for visualization, or normalizing offsets in dynamic layouts. Not needed for PCA since it preserves global structure.

use simple dimensionality reduction as fourth algo to compare to. A naïve downsampling method that reduces dimensionality by uniformly averaging non-overlapping groups of input dimensions, assuming equal contribution.
