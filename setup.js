
function loadScript(name) {
  var url = chrome.extension.getURL(name)
  var script = document.createElement('script');
  script.setAttribute("type", "application/javascript");
  script.setAttribute("src", url)
  document.body.appendChild(script)
}

loadScript('enhancer.js')
loadScript('caveatPatchor.js')

