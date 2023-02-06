const yaml = require('js-yaml')
const fs = require('fs')
const axios = require('axios')
require('format-unicorn')

const saveLast = 3
const apiUrl =
  'https://api.github.com/repos/krateoplatformops/krateo-module-core/tags'
const compositionUrl =
  'https://raw.githubusercontent.com/krateoplatformops/krateo-module-core/{tag}/core/composition.yaml'

const main = async () => {
  let releases = []
  // Load releases from krateo-module-core
  await axios
    .get(apiUrl)
    .then(async (res) => {
      await Promise.all(
        res.data.map(async (tag) => {
          const url = compositionUrl.formatUnicorn({ tag: tag.name })
          const composition = await axios.get(url)
          const doc = yaml.load(composition.data)

          doc.spec.resources.forEach((r) => {
            try {
              const name = r.base.spec.forProvider.chart.name
              const version = r.base.spec.forProvider.chart.version
              if (!releases[name]) {
                releases[name] = []
              }
              if (!releases[name].includes(version)) {
                releases[name].push(version)
              }
            } catch {}
          })
        })
      )
    })
    .catch((err) => {
      console.log(err)
    })
  // Clear the index.yaml of krateo-charts
  const doc = yaml.load(fs.readFileSync('./index.yaml', 'utf8'))
  const catalog = {
    ...doc
  }
  Object.keys(catalog.entries).forEach((key) => {
    const v = catalog.entries[key]
    if (releases[key]) {
      catalog.entries[key] = v.filter((f, i) => {
        return (
          releases[key].includes(f.version) ||
          i >= catalog.entries[key].length - saveLast
        )
      })
    } else {
      catalog.entries[key] = catalog.entries[key].slice(-1 * saveLast)
    }
  })
  fs.writeFileSync('./index.yaml', yaml.dump(catalog))
  // Clear the charts folder
  fs.readdir('./', (err, filename) => {
    if (err) {
      console.log(err)
    } else {
      filename.forEach((f) => {
        if (f.endsWith('.tgz')) {
          const li = f.lastIndexOf('-')
          const name = f.substring(0, li)
          const version = f.substring(li + 1, f.length - 4)
          if (!catalog.entries[name]?.find((x) => x.version === version)) {
            try {
              fs.rmSync(f)
            } catch {}
          }
        }
      })
    }
  })
}

main()
