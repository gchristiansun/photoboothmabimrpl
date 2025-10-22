import React, { useRef, useState, useEffect } from 'react'
import { drawImageCover } from '../utils/imageUtils'

export default function PhotoStripComposer() {
  const canvasRef = useRef(null)
  const [frameSrc, setFrameSrc] = useState('/frame.png')
  const [frameJson, setFrameJson] = useState('Default Frame');
  const [fileName, setFileName] = useState("")
  const [frameImg, setFrameImg] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 1200 })
  const [slots, setSlots] = useState([]) // otomatis dari area bolong
  const [activeSlotIndex, setActiveSlotIndex] = useState(null)
  // const [editingSlot, setEditingSlot] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 })


  const frameCategories = {
    "3x": [
      { name: "Frame 3x - 1", src: "3x/frame3x-1.png", json: "3x/frame3x-1.png.json" },
      { name: "Frame 3x - 2", src: "3x/frame3x-2.png", json: "3x/frame3x-2.png.json" },
      
    ],
    "6x": [
      { name: "Frame 6x - 1", src: "6x/frame6x-1.png", json: "6x/frame6x-1.png.json" },
    ],
  }

  const [selectedCategory, setSelectedCategory] = useState("3x")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mouseleave', handleMouseUp)
    return () => canvas.removeEventListener('mouseleave', handleMouseUp)
  }, [])


  useEffect(() => { 
    if (!frameSrc) return 
    const img = new Image() 
    console.log(frameSrc)
    img.crossOrigin = 'anonymous' 
    img.onload = () => { setFrameImg(img) 
      setCanvasSize({ w: img.width, h: img.height }) 
      if (frameJson == "") {
        detectTransparentAreas(img) 
      } else {
        fetch(frameJson)
        .then(res => res.json())
        .then(data => {
          setCanvasSize(data.size);
          setSlots(data.slots.map(s => ({
            ...s,
            img: null,
            imgSrc: null,
            offsetX: 0,
            offsetY: 0,
            scale: 1
          })));
        });
      }
    } 
    img.src = frameSrc }, [frameSrc]
    
  )

  function detectTransparentAreas(img) {
    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d')
    tempCanvas.width = img.width
    tempCanvas.height = img.height
    ctx.drawImage(img, 0, 0)

    const imgData = ctx.getImageData(0, 0, img.width, img.height)
    const { data } = imgData

    let regions = []
    let visited = new Uint8Array(img.width * img.height)
    const getIndex = (x, y) => y * img.width + x

    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const idx = getIndex(x, y)
        if (visited[idx]) continue
        const alpha = data[idx * 4 + 3]
        if (alpha < 10) {
          // mulai region transparan
          let minX = x, maxX = x, minY = y, maxY = y
          let stack = [[x, y]]
          visited[idx] = 1
          while (stack.length) {
            const [cx, cy] = stack.pop()
            const ci = getIndex(cx, cy)
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx, ny = cy + dy
                if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue
                const ni = getIndex(nx, ny)
                if (visited[ni]) continue
                const a = data[ni * 4 + 3]
                if (a < 10) {
                  visited[ni] = 1
                  stack.push([nx, ny])
                  minX = Math.min(minX, nx)
                  maxX = Math.max(maxX, nx)
                  minY = Math.min(minY, ny)
                  maxY = Math.max(maxY, ny)
                }
              }
            }
          }
          // abaikan region kecil (noise)
          if (maxX - minX > 10 && maxY - minY > 10) {
            regions.push({
              x: minX,
              y: minY,
              w: maxX - minX,
              h: maxY - minY,
            })
          }
        }
      }
    }

    setSlots(regions.map(r => ({
      ...r,
      img: null,
      imgSrc: null,
      offsetX: 0,
      offsetY: 0,
      scale: 1
    })))
  }

  useEffect(() => {
    renderCanvas()
  }, [frameImg, slots])

function handleMouseDown(e) {
  const rect = e.target.getBoundingClientRect()
  
  // ⭐ Dapatkan ukuran internal kanvas (berdasarkan props)
  const canvas = canvasRef.current
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  
  // ⭐ Terapkan faktor skala pada koordinat mouse
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY

  // cari slot yang diklik
  const clickedIndex = slots.findIndex(
    s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
  )

  if (clickedIndex === -1) return 

  setActiveSlotIndex(clickedIndex) 
  setIsDragging(true)
  setLastMouse({ x, y })
}

function handleMouseMove(e) {
  if (!isDragging || activeSlotIndex === null) return

  const rect = e.target.getBoundingClientRect()
  
  // Dapatkan faktor skala kanvas untuk perhitungan mouse
  const canvas = canvasRef.current
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  // Terapkan faktor skala pada koordinat mouse
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  
  const dx = x - lastMouse.x
  const dy = y - lastMouse.y
  setLastMouse({ x, y })

  setSlots(prev => {
    const updated = [...prev]
    const s = { ...updated[activeSlotIndex] }
    
    // --- START: Logika Batasan (Clamping) Baru ---
    if (s.img) {
      // 1. Hitung dimensi gambar yang diskalakan
      const scaledWidth = s.img.width * s.scale
      const scaledHeight = s.img.height * s.scale

      // Pastikan gambar cukup besar untuk menutupi slot agar logika batasan berfungsi
      // Logika ini hanya relevan jika gambar telah di-zoom untuk menutupi (scaledWidth >= s.w dan scaledHeight >= s.h)
      if (scaledWidth >= s.w && scaledHeight >= s.h) {

        // 2. Tentukan batas geser horizontal (X)
        const maxOffsetX = (scaledWidth - s.w) / 2
        const minOffsetX = -maxOffsetX
        
        // 3. Tentukan batas geser vertikal (Y)
        const maxOffsetY = (scaledHeight - s.h) / 2
        const minOffsetY = -maxOffsetY
        
        // 4. Terapkan pergerakan (dx, dy)
        let newOffsetX = s.offsetX + dx
        let newOffsetY = s.offsetY + dy
        
        // 5. Terapkan Batasan (Clamping)
        // Gunakan Math.max dan Math.min untuk memastikan offset tidak keluar batas
        s.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, newOffsetX))
        s.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, newOffsetY))
      } 
      // JIKA gambar lebih kecil dari slot di salah satu dimensi, kita bisa membiarkannya
      // tetap di tengah (offsetX dan offsetY tetap 0) atau menggunakan logika 'Contain'
      // Namun, jika Anda menggunakan skala 'Cover' (seperti yang disarankan sebelumnya),
      // kondisi 'if' ini seharusnya selalu terpenuhi.
    }
    // --- END: Logika Batasan (Clamping) Baru ---

    updated[activeSlotIndex] = s
    return updated
  })
}

function handleMouseUp() {
  setIsDragging(false)
}

function handleWheel(e) {
  e.preventDefault()
  if (activeSlotIndex === null) return

  const zoom = e.deltaY < 0 ? 1.05 : 0.95

  setSlots(prev => {
    const updated = [...prev]
    const s = { ...updated[activeSlotIndex] }
    
    // ⭐ START: Logika Batasan Zoom Out ⭐
    if (s.img) {
      // 1. Hitung skala minimum (Skala "Cover")
      const scaleX = s.w / s.img.width
      const scaleY = s.h / s.img.height
      const minScale = Math.max(scaleX, scaleY) // Skala terbesar = skala cover

      // 2. Hitung skala baru yang diinginkan
      let newScale = s.scale * zoom
      
      // 3. Terapkan Batasan (Clamp)
      // s.scale harus minimal seukuran minScale (agar slot tertutup)
      newScale = Math.max(minScale, newScale)

      // Juga pertahankan batas zoom in maksimum (misalnya 3x)
      s.scale = Math.min(3, newScale)
      
      // ⭐ 4. Pastikan posisi gambar tetap di tengah jika mencapai batas minScale
      // Ini sangat penting agar gambar tidak bergeser aneh saat mencapai batas zoom out.
      if (s.scale === minScale) {
        // Hitung ulang offset untuk menengahkan gambar pada skala minimum
        const scaledWidth = s.img.width * minScale;
        const scaledHeight = s.img.height * minScale;
        s.offsetX = (s.w - scaledWidth) / 2;
        s.offsetY = (s.h - scaledHeight) / 2;
      }

    } else {
      // Jika tidak ada gambar, tetap gunakan logika zoom standar jika ada
      s.scale = Math.max(0.3, Math.min(3, s.scale * zoom))
    }
    // ⭐ END: Logika Batasan Zoom Out ⭐

    updated[activeSlotIndex] = s
    return updated
  })
}

  function renderCanvas() {
    const canvas = canvasRef.current
    if (!canvas || !frameImg) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // gambar slot (foto di bawah frame)
    slots.forEach((s) => {
      if (s.img) {
        const cx = s.x + s.w / 2 + s.offsetX
        const cy = s.y + s.h / 2 + s.offsetY
        const iw = s.img.width * s.scale
        const ih = s.img.height * s.scale
        const sx = cx - iw / 2
        const sy = cy - ih / 2
        ctx.save()
        ctx.beginPath()
        ctx.rect(s.x, s.y, s.w, s.h)
        ctx.clip()
        ctx.drawImage(s.img, sx, sy, iw, ih)
        ctx.restore()
      } else {
        ctx.strokeStyle = '#0af'
        ctx.lineWidth = 2
        ctx.strokeRect(s.x, s.y, s.w, s.h)
      }
    })

    // gambar frame paling atas
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height)
  }

  function handleFrameUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setFrameSrc(url)
  }

  function handleSlotImageUpload(e, index) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setSlots((prev) => {
        const updated = [...prev]
        const slot = updated[index];
        // ⭐ PERHITUNGAN BARU: Skala agar tinggi foto sama dengan tinggi slot
        // Gunakan Math.min agar gambar selalu terlihat (jika foto lebih kecil dari slot)
        // atau Math.max jika Anda ingin foto pasti memenuhi slot (menutup area)
        const newScale = slot.h / img.height; // Skala yang diperlukan agar tinggi foto = tinggi slot

        updated[index] = {
          ...slot, // Gunakan slot yang sudah ada (updated[index])
          imgSrc: url,
          img,
          offsetX: 0,
          offsetY: 0,
          scale: newScale // ⭐ Terapkan skala yang sudah dihitung
        }
        return updated
      })
      setActiveSlotIndex(index)
    }
    img.src = url
  }

function handleSlotImageUploadAll(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file, index) => {
      if (index >= slots.length) return;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setSlots(prev => {
          const updated = [...prev];
          const slot = updated[index]; // Dapatkan data slot
          
          // ⭐ PERHITUNGAN BARU
          const newScale = slot.h / img.height; // Skala agar tinggi foto = tinggi slot

          updated[index] = { 
            ...slot, 
            imgSrc: url, 
            img, 
            offsetX: 0, 
            offsetY: 0, 
            scale: newScale // ⭐ Terapkan skala yang sudah dihitung
          };
          return updated;
        });
        if (index === files.length - 1) { 
          setActiveSlotIndex(index);
        }
      };
      img.src = url;
    });
  }

  function downloadComposite() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ubah ke JPEG dan turunkan kualitas (0.7 = 70%)
    const dataUrl = canvas.toDataURL('image/jpeg');

    const name = fileName || 'photo-strip';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name.endsWith('.jpg') ? name : name + '.jpg';
    a.click();
  }


  return (
    <div className='flex w-screen overflow-x-hidden bg-white'>
      <div className='z-10 fixed bottom-5 left-5 flex gap-2 my-auto'>
        <div className="">
          <label className="mr-2">Nama File:</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="photo-strip"
            className="border px-2 py-1 my-auto h-full rounded-xl"
          />
        </div>
        <button onClick={downloadComposite}>Download</button>
        <button onClick={() => {
          const data = {
              size: canvasSize,
              slots: slots.map(s => ({
                x: Math.round(s.x),
                y: Math.round(s.y),
                w: Math.round(s.w),
                h: Math.round(s.h)
              }))
          }
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = frameSrc.replace('.png', '.png.json').split('/').pop()
          a.click()
          }}>Generate JSON
        </button>
        
      </div>

      <div className='w-2/3 fixed bottom-0 left-0 h-[100vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] 
                [&::-webkit-scrollbar]:hidden'>
        <div className='flex justify-center p-10 mb-10'>
          <h1 className=''>Photobooth Mabim</h1>
        </div>
        <div className='flex justify-center'>
<canvas
  ref={canvasRef}
  width={canvasSize.w}
  height={canvasSize.h}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onWheel={handleWheel}
  style={{
    width: '40%',
    height: 'auto',
    justifyItems: 'center', 
    paddingBottom: '50px',
    cursor: isDragging ? 'grabbing' : 'grab'
  }}
/>
       
        </div>
      </div>
      

      <div className='w-1/3 fixed h-[90vh] top-10 right-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] 
                [&::-webkit-scrollbar]:hidden pl-8'>        
        <div className="bg-white text-black p-4 rounded-xl mb-5">
          <h3 className="text-2xl font-bold mb-3">Pilih Jenis Frame</h3>

          {/* Pilih kategori */}
          <div className="flex gap-3 mb-4">
            {Object.keys(frameCategories).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-2 px-4 rounded-lg font-semibold border 
                  ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Daftar frame dari kategori terpilih */}
          <div className="flex gap-3 flex-wrap">
            {frameCategories[selectedCategory].map((f, i) => (
              <div
                key={i}
                onClick={() => {setFrameSrc(f.src); setFrameJson(f.json);}}
                className={`cursor-pointer border-2 rounded-xl overflow-hidden transition 
                  ${frameSrc === f.src ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}
              >
                <img src={f.src} alt={f.name} className="w-24 h-36 object-cover" />
                <p className="text-center text-sm mt-1">{f.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className=' bg-white text-black p-5 rounded-xl mb-5'>
          <h3 className='text-2xl font-bold'>Upload Photo All</h3>
          <input className="cursor-pointer text-xl" type="file" multiple accept="image/*" onChange={handleSlotImageUploadAll} />
        </div>

        <div className=' bg-white text-black p-5 rounded-xl'>
          <h3 className='text-2xl font-bold'>Upload Photo</h3>
          {slots.map((s, i) => (
  <div
    key={i}
    className={`text-xl border-2 border-dashed rounded-lg p-4 mb-4 transition-colors relative ${
      activeSlotIndex === i ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
    }`}
    onClick={() => setActiveSlotIndex(i)}
    onDragOver={(e) => e.preventDefault()}
    onDragEnter={() => setActiveSlotIndex(i)}
    onDragLeave={() => setActiveSlotIndex(null)}
    onDrop={(e) => {
      e.preventDefault();
      setActiveSlotIndex(null);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const fakeEvent = { target: { files: [file] } };
        handleSlotImageUpload(fakeEvent, i);
      }
    }}
  >
    <p className="font-semibold mb-2">
      Slot {i + 1} ({Math.round(s.x)}, {Math.round(s.y)})
    </p>

    {/* Preview foto */}
    {s.imgSrc ? (
      <div className="relative mb-2">
        <img
          src={s.imgSrc}
          alt={`Slot ${i + 1}`}
          className="w-full rounded-lg border border-gray-200"
        />
        <button
          onClick={() => {
            setSlots((prev) => {
              const updated = [...prev];
              updated[i] = { ...updated[i], img: null, imgSrc: null };
              return updated;
            });
          }}
          className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-700 transition"
          title="Hapus foto"
        >
          ✕
        </button>
      </div>
    ) : (
      <p className="text-gray-500 italic mb-2">Belum ada foto</p>
    )}

    {/* Upload manual */}
    <input
      className="cursor-pointer text-base"
      type="file"
      accept="image/*"
      onChange={(e) => handleSlotImageUpload(e, i)}
    />

    {/* Petunjuk drag & drop */}
    <p className="text-sm text-gray-400 mt-1">
      Drag & drop gambar ke area ini untuk upload cepat
    </p>
  </div>
))}


        </div>
      </div>
    </div>
  )
}
