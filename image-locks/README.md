# Image Locks

Image lock files describe stable image digests for environments.

Preview generation uses `image-locks/main.json` for stable dependencies. Candidate images from `preview-metadata/pr-<number>.json` override stable images only for affected components.

Production promotion later must promote from a staging lock or another signed promotion source. It should not rebuild images during promotion.
