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
          setSlots(data.slots);
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
          if (maxX - minX > 100 && maxY - minY > 100) {
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

    setSlots(regions)
  }

  useEffect(() => {
    renderCanvas()
  }, [frameImg, slots])

  function renderCanvas() {
    const canvas = canvasRef.current
    if (!canvas || !frameImg) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // gambar slot (foto di bawah frame)
    slots.forEach((s) => {
      if (s.img) {
        drawImageCover(ctx, s.img, s.x, s.y, s.w, s.h)
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
        updated[index] = { ...updated[index], imgSrc: url, img }
        return updated
      })
    }
    img.src = url
  }

  function handleSlotImageUploadAll(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  files.forEach((file, index) => {
    if (index >= slots.length) return; // pastikan tidak melebihi jumlah slot

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSlots(prev => {
        const updated = [...prev];
        const slot = updated[index];

        // buat canvas sementara untuk crop otomatis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = slot.w;
        tempCanvas.height = slot.h;
        const tempCtx = tempCanvas.getContext('2d');

        // draw gambar dengan cover agar memenuhi slot
        drawImageCover(tempCtx, img, 0, 0, slot.w, slot.h);

        // simpan hasil crop sebagai image baru
        const croppedImg = new Image();
        croppedImg.src = tempCanvas.toDataURL('image/png');

        updated[index] = { ...slot, img: croppedImg, imgSrc: url };
        return updated;
      });
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
            style={{
              width: '20%',
              height: 'auto',
              justifyItems: 'center', 
              paddingBottom: '50px'         
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
            <div key={i} className='text-xl'>
              Slot {i + 1} ({Math.round(s.x)},{Math.round(s.y)})
              <input className="cursor-pointer text-xl" type="file" multiple accept="image/*" onChange={(e) => handleSlotImageUpload(e, i)} />

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
