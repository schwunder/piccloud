first folder with pics done
rename durer done
second db with names done
rename durer in db done
third caddyfile done
fourth bun server done
index.html done
client.js done
favicon.ico done
pictures are clickable
split hmtl body in half
one half images buttons thumbnails
other half resized image
resized image and caddy file?
resized image and client.js?
caddyfile uploading resized folder only after thumbnails folder loaded
after resized folder found in client
create new mapping from thumbnails to resized
thumbnails are clickable
after clicking thumbnail, resized image is shown
on the other half the resized image is shown

first add change from public to public/thumbnails
then add public/resized
this is for caddyfile
other path to display localhost:3001/thumbnails and localhost:3001/resized?

check with all 8500
do umap and tsne
for this to work
need to get all the other files into this project
auweier

now get database functions to behave for each file that uses it.
get embeddings for dimensionality reduction
get points for server

// before that clean db
// new schema
// add projection umap x and y
// remove single projcetion from db
// rename projection_x and projection_y to pca x and y
// make it an number[]
// update pca.js

clearedValues new Table with new Schema or just add new projection
new schema new Table


Clustering & Dimensionality Reduction Project

What I Already Have:
[ ] Three clustering dimensionality reduction algorithms: PCA, UMAP, and t-SNE
[ ] A database with 8,500 picture sets sorted by 50 famous artists like Van Gogh and Rembrandt
[ ] Metadata for images, including classification into art movements such as Impressionism and Cubism
[ ] A server that serves index.html and the client
[ ] Configuration files, including bun.lockb, package.json, and the Caddyfile (a simplified JSON-like format)
[ ] The favicon is in the root but should be in public
[ ] Four scripts: a D3.js script, UMAP script, PCA script, and t-SNE script
[ ] Writing t-SNE data values into the database
[ ] Basic validation and verification of PCA, t-SNE, and UMAP outputs
[ ] Ensuring clustering is meaningful and corresponds to artists or metadata classifications
[ ] Tools for manual and intuitive verification
[ ] Scaling and formatting clustering output for D3.js visualization

Implementation Queue

Code Organization & Structuring (2-3 hours)
This lays the foundation for everything else, making subsequent tasks easier to maintain and debug.
[ ] Consolidate some functionality into a single file
[ ] Add comments for clarity
[ ] Consolidate database operations into functions
[ ] Parameterize functions but keep them hard-coded and efficient
[ ] Keep everything minimal in lines of code
[ ] Improve code structuring and folding in the IDE
Server & Configuration Updates (1-2 hours)
After code organization, it will be simpler to move files around, set up reverse proxying, and serve content properly.
[ ] Move favicon.ico to the public folder
[ ] Serve index.html, scripts, and assets correctly from the server
[ ] Organize configuration files (bun.lockb, package.json, Caddyfile) for readability
[ ] Try reverse proxying in the Caddy file
Algorithm Integration & Validation (3-4 hours)
With the codebase and server structures stable, integrate the algorithms cleanly and verify the outputs.
[ ] Store t-SNE outputs in the database
[ ] Validate or verify PCA, t-SNE, and UMAP outputs
[ ] Ensure clustering results are meaningful
[ ] Develop algorithmic verification tools alongside manual checks
[ ] Make sure clustering output is well-formatted for D3.js
[ ] Confirm that clusters match metadata (e.g., Impressionism vs. Cubism)
MCP Server & Debugging (2 hours)
Once the main functionality is in place, set up debugging tools to streamline testing.
[ ] Configure MCP servers
[ ] Handle cursor ID
[ ] Check if a Chrome extension for MCP debugging works in Orion Browser
[ ] Verify the extension packs front-end output and DOM data into the cursor ID
Research & Documentation (1-2 hours)
Finally, document everything so future iterations and integrations are smoother.
[ ] Research and document PCA, UMAP, and t-SNE
[ ] Explore D3.js for visualization details
[ ] Document best practices for clustering verification
Future Considerations:
[ ] Keep clustering methods agnostic, but consider metadata-aware approaches
[ ] Develop better tools to analyze and interpret clustering results
[ ] Keep the system ready for potential client integration