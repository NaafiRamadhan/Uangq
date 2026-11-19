export function readTextFile(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Isi file tidak dapat dibaca sebagai teks.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('File gagal dibaca.'))
    reader.onabort = () => reject(new Error('Pembacaan file dibatalkan.'))

    try {
      reader.readAsText(file)
    } catch (error) {
      reject(error)
    }
  })
}
