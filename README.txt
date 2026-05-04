FireOps Calc homepage/tools style fix v3

Problem fixed:
- The previous update linked to /css/fireops-unified.css, but the project only had a ccs folder.
- Because the stylesheet was missing, the page displayed as mostly white with plain text.

What changed:
- Added the correct css/fireops-unified.css file.
- Kept ccs/fireops-unified.css in sync for compatibility.
- Updated the homepage and tool/reference pages to use the correct relative stylesheet path.
- Rebuilt /dist so the deploy-ready site includes the styled homepage and tools.
- Updated package.json so future npm run build copies the css folder and scenario-trainer folder.

Best option for Netlify:
- Upload or deploy the contents of the dist folder from fireops_dist_ready_v3.zip.

Best option if replacing project files:
- Extract fireops_style_fix_patch_v3.zip into your project root and allow it to overwrite matching files.
- Then run npm run build.
- Deploy the rebuilt dist folder.

Important files:
- index.html
- css/fireops-unified.css
- package.json
- dist/index.html
- dist/css/fireops-unified.css
- dist/tools/*
