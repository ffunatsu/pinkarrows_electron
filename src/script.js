import { createArrow, setArrowHeadPoint } from './arrow.js'
import { hasDistinctEndpoints } from './line-utils.mjs'
// Import the functions you need from the SDKs you need

var emojiPicker = null;

class CustomTextbox extends fabric.Textbox {
  constructor(text, options) {
    super(text, {
      paintFirst: 'stroke',
      strokeLineJoin: 'round',
      ...options
    });
    this.on('editing:entered', function () {
      console.log('Entered edit mode');
      setMode(Mode.EDIT_TEXT);
    });

    this.on('editing:exited', function () {
      setMode(Mode.NONE);
    });
  }
}

async function openEmojiPicker() {
  if (emojiPicker == null) {
    await loadEmojiPopup()
  }
  emojiPicker.open()
}

async function loadEmojiPopup() {
  let { createPopup } = await import('https://unpkg.com/@picmo/popup-picker@latest/dist/index.js?module')
  const trigger = document.querySelector('#emoji-button');//$('#emoji-button')

  emojiPicker = createPopup({
    showCategoryTabs: false
    // picker options go here
  }, {
    referenceElement: trigger,
    triggerElement: trigger
  });
  emojiPicker.addEventListener('emoji:select', selection => {
    console.log('Selected emoji: ', selection.emoji);
    let text = new fabric.IText(selection.emoji, {
      left: 100,
      top: 100,
      fontFamily: 'sans-serif',
      fontSize: 100,
      fill: annotationColor,
      stroke: '#ffffff', // White border
      strokeWidth: 2,
      strokeLineJoin: 'round',
      paintFirst: 'stroke',
      shadow: 'rgba(0,0,0,0.3) 2px 2px 2px',  // Black shadow
      fontWeight: '900',
    });
    canvas.add(text)
    setMode(Mode.NONE)
  });
}

const DEFAULT_FONTS = [
  { name: 'Noto Sans JP', value: "'Noto Sans JP', sans-serif" },
  { name: 'Default Sans', value: 'sans-serif' },
  { name: 'Segoe UI', value: "'Segoe UI', sans-serif" },
  { name: 'Meiryo', value: "'Meiryo', sans-serif" },
  { name: 'Yu Gothic', value: "'Yu Gothic', sans-serif" },
  { name: 'MS PGothic', value: "'MS PGothic', sans-serif" },
  { name: 'Arial', value: "'Arial', sans-serif" },
  { name: 'Helvetica', value: "'Helvetica', sans-serif" },
  { name: 'Impact', value: "'Impact', sans-serif" },
  { name: 'Times New Roman', value: "'Times New Roman', serif" },
  { name: 'Courier New', value: "'Courier New', monospace" }
];

let localFontsLoaded = false;

async function initFontList() {
  const fontSelect = $('#font-family-select');
  const storedFont = localStorage.getItem('pinkarrows_font_family') || "'Noto Sans JP', sans-serif";

  let fontOptionsMap = new Map();
  DEFAULT_FONTS.forEach(f => fontOptionsMap.set(f.name, f.value));

  if ('queryLocalFonts' in window) {
    try {
      const localFonts = await window.queryLocalFonts();
      if (localFonts && localFonts.length > 0) {
        localFontsLoaded = true;
        const localFamilies = new Set();
        for (const font of localFonts) {
          if (font.family && !font.family.startsWith('.')) {
            localFamilies.add(font.family);
          }
        }
        const sortedLocal = Array.from(localFamilies).sort((a, b) => a.localeCompare(b));
        sortedLocal.forEach(family => {
          if (!fontOptionsMap.has(family)) {
            fontOptionsMap.set(family, `"${family}", sans-serif`);
          }
        });
      }
    } catch (e) {
      console.warn('Could not query local fonts initially:', e);
    }
  }

  fontSelect.empty();
  for (const [name, val] of fontOptionsMap.entries()) {
    fontSelect.append($('<option>', {
      value: val,
      text: name
    }));
  }

  // Restore stored value if exists, or select default
  let found = false;
  for (const val of fontOptionsMap.values()) {
    if (val === storedFont) {
      found = true;
      break;
    }
  }
  if (found) {
    fontSelect.val(storedFont);
  } else {
    fontSelect.val("'Noto Sans JP', sans-serif");
  }
}

async function loadSystemFontsIfNeeded() {
  if (localFontsLoaded) return;
  if ('queryLocalFonts' in window) {
    try {
      const localFonts = await window.queryLocalFonts();
      if (localFonts && localFonts.length > 0) {
        localFontsLoaded = true;
        const fontSelect = $('#font-family-select');
        const currentVal = fontSelect.val();

        let fontOptionsMap = new Map();
        DEFAULT_FONTS.forEach(f => fontOptionsMap.set(f.name, f.value));

        const localFamilies = new Set();
        for (const font of localFonts) {
          if (font.family && !font.family.startsWith('.')) {
            localFamilies.add(font.family);
          }
        }
        const sortedLocal = Array.from(localFamilies).sort((a, b) => a.localeCompare(b));
        sortedLocal.forEach(family => {
          if (!fontOptionsMap.has(family)) {
            fontOptionsMap.set(family, `"${family}", sans-serif`);
          }
        });

        fontSelect.empty();
        for (const [name, val] of fontOptionsMap.entries()) {
          fontSelect.append($('<option>', {
            value: val,
            text: name
          }));
        }
        fontSelect.val(currentVal);
      }
    } catch (e) {
      console.warn('Could not load local fonts on demand:', e);
    }
  }
}

function getTextSettings() {
  const fontFamily = $('#font-family-select').val() || "'Noto Sans JP', sans-serif";
  const fontWeight = $('#font-weight-select').val() || '700';
  const strokeWidth = parseInt($('#stroke-width-select').val(), 10) ?? 4;
  return { fontFamily, fontWeight, strokeWidth };
}

function updateActiveTextObject(props) {
  const activeObj = canvas.getActiveObject();
  if (!activeObj) return;

  const targets = (activeObj.type === 'activeSelection') ? activeObj.getObjects() : [activeObj];
  let modified = false;

  targets.forEach(obj => {
    if (obj instanceof fabric.Textbox || obj instanceof fabric.IText || obj.type === 'textbox' || obj.type === 'i-text') {
      if (props.fontFamily !== undefined) {
        obj.set('fontFamily', props.fontFamily);
      }
      if (props.fontWeight !== undefined) {
        obj.set('fontWeight', props.fontWeight);
      }
      if (props.strokeWidth !== undefined) {
        obj.set('strokeWidth', props.strokeWidth);
      }
      modified = true;
    }
  });

  if (modified) {
    canvas.requestRenderAll();
    if (canvas.fire) {
      canvas.fire('object:modified', { target: activeObj });
    }
  }
}

function syncTextControlsFromSelection() {
  const activeObj = canvas.getActiveObject();
  if (!activeObj) return;

  const target = (activeObj.type === 'activeSelection') ? activeObj.getObjects()[0] : activeObj;
  if (target && (target instanceof fabric.Textbox || target instanceof fabric.IText || target.type === 'textbox' || target.type === 'i-text')) {
    if (target.fontFamily) {
      $('#font-family-select').val(target.fontFamily);
    }
    if (target.fontWeight) {
      $('#font-weight-select').val(String(target.fontWeight));
    }
    if (target.strokeWidth !== undefined) {
      $('#stroke-width-select').val(String(target.strokeWidth));
    }
  }
}

function updateZoomUI(zoom) {
  const select = $('#zoom-select');
  const pct = Math.round(zoom * 100);
  let matched = false;
  select.find('option').each(function () {
    const val = $(this).val();
    if (val !== 'fit' && Math.round(parseFloat(val) * 100) === pct) {
      select.val(val);
      matched = true;
    }
  });
  if (!matched) {
    let customOpt = select.find('option[data-custom="true"]');
    if (customOpt.length === 0) {
      customOpt = $('<option data-custom="true"></option>').appendTo(select);
    }
    customOpt.val(zoom).text(`${pct}%`).prop('selected', true);
  }
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

function zoomToPoint(point, newZoom) {
  if (newZoom < MIN_ZOOM) newZoom = MIN_ZOOM;
  if (newZoom > MAX_ZOOM) newZoom = MAX_ZOOM;
  canvas.zoomToPoint(point, newZoom);
  updateZoomUI(newZoom);
  canvas.requestRenderAll();
}

function zoomIn() {
  const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  const currentZoom = canvas.getZoom();
  zoomToPoint(center, currentZoom * 1.25);
}

function zoomOut() {
  const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  const currentZoom = canvas.getZoom();
  zoomToPoint(center, currentZoom / 1.25);
}

function resetZoom() {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  updateZoomUI(1);
  canvas.requestRenderAll();
}

function setZoomCenter(newZoom) {
  const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  zoomToPoint(center, newZoom);
}

function zoomFit() {
  const objects = canvas.getObjects();
  if (objects.length === 0) {
    resetZoom();
    return;
  }

  // Calculate bounding box in untransformed scene coordinates
  const currentVpt = canvas.viewportTransform.slice();
  canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
  const tempGroup = new fabric.Group(objects);
  const boundingRect = tempGroup.getBoundingRect();
  tempGroup.destroy();
  canvas.viewportTransform = currentVpt;

  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const scaleX = (canvasWidth * 0.9) / (boundingRect.width || 1);
  const scaleY = (canvasHeight * 0.9) / (boundingRect.height || 1);
  let zoom = Math.min(scaleX, scaleY, 1.0);
  if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;

  const panX = (canvasWidth - boundingRect.width * zoom) / 2 - boundingRect.left * zoom;
  const panY = (canvasHeight - boundingRect.height * zoom) / 2 - boundingRect.top * zoom;

  canvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
  $('#zoom-select').val('fit');
  canvas.requestRenderAll();
}

$(document).ready(function () {
  $('#zoom-in-btn').click(() => zoomIn());
  $('#zoom-out-btn').click(() => zoomOut());
  $('#zoom-reset-btn').click(() => resetZoom());

  $('#zoom-select').change(function () {
    const val = $(this).val();
    if (val === 'fit') {
      zoomFit();
    } else {
      const z = parseFloat(val);
      if (!isNaN(z)) {
        setZoomCenter(z);
      }
    }
  });

  $('#emoji-button').click(() => {
    openEmojiPicker()
  })

  $('#undo-button').click(() => {
    canvas.undo()
  })

  $('#redo-button').click(() => {
    canvas.redo()
  })

  $('#download-button').click(() => {
    downloadCroppedWithWatermark()
  })


  $('#copy-image-to-clipboard-button').click(() => {
    copyImageToClipboard()
  })

  // Screenshot capture button
  $('#capture-screen-btn').click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    captureScreenshot();
  });

  // Prevent browser autoscroll on middle click over drop_area / canvas
  $('#drop_area').on('mousedown auxclick', function (e) {
    if (e.button === 1 || e.which === 2) {
      e.preventDefault();
    }
  });

  // Handle file-upload-button click
  $('#file-upload-button').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('fileInput').click();
  });

  // Also allow clicking anywhere on the image-placeholder (excluding buttons)
  $('#image-placeholder').on('click', function (e) {
    if ($(e.target).closest('#file-upload-button, #capture-screen-btn').length > 0) {
      return;
    }
    document.getElementById('fileInput').click();
  });

  // Add this to handle the file input change
  $('#fileInput').change(function () {
    handleFiles(this.files);
    // Clear the input to ensure the change event triggers even if the same file is selected again
    this.value = null;
  });

  // Initialize watermark toggle state from localStorage
  const watermarkToggle = $('#watermark-toggle');
  let watermarkState = localStorage.getItem('watermark');

  // If watermark state is not set in localStorage, default to true
  if (watermarkState === null) {
    watermarkState = 'true';
    localStorage.setItem('watermark', watermarkState);
  }

  watermarkToggle.prop('checked', watermarkState === 'true');

  // Handle watermark toggle change
  watermarkToggle.change(function () {
    const isChecked = $(this).is(':checked');
    localStorage.setItem('watermark', isChecked);
  });

  // Initialize and bind Text styling controls
  const storedWeight = localStorage.getItem('pinkarrows_font_weight');
  if (storedWeight) {
    $('#font-weight-select').val(storedWeight);
  }
  const storedStroke = localStorage.getItem('pinkarrows_stroke_width');
  if (storedStroke !== null) {
    $('#stroke-width-select').val(storedStroke);
  } else {
    $('#stroke-width-select').val('4');
  }

  initFontList();

  $('#font-family-select').on('focus', function () {
    loadSystemFontsIfNeeded();
  });

  $('#font-family-select').change(async function () {
    const val = $(this).val();
    localStorage.setItem('pinkarrows_font_family', val);
    try {
      await document.fonts.load(`16px ${val}`);
    } catch (e) {}
    updateActiveTextObject({ fontFamily: val });
  });

  $('#font-weight-select').change(function () {
    const val = $(this).val();
    localStorage.setItem('pinkarrows_font_weight', val);
    updateActiveTextObject({ fontWeight: val });
  });

  $('#stroke-width-select').change(function () {
    const val = parseInt($(this).val(), 10);
    localStorage.setItem('pinkarrows_stroke_width', val);
    updateActiveTextObject({ strokeWidth: val });
  });

  function refreshUI() {
    if (loggedInUser) {
      $('#userAccountDropdownMenu').removeClass('d-none'); // show the menu
      $('#userNameItem').text(loggedInUser.email)
      $('#signUpButtonItem').addClass('d-none')
      getPriceURL()
      loggedInUser.isPro = getCustomerIsProStatus()
      console.log(loggedInUser)


      console.log(loggedInUser.displayName, "is signed in")
    } else {
      $('#userAccountDropdownMenu').addClass('d-none'); // hide the menu
      $('#signUpButtonItem').removeClass('d-none')
      console.log("no user is signed in")
    }

  }

  // Build the color palette
  const colorPalette = $('#color-palette');
  const customColorInput = $('#custom-color-input');
  ANNOTATION_COLORS.forEach(color => {
    const swatch = $('<button type="button" class="color-swatch"></button>')
      .attr('data-color', color)
      .attr('title', color)
      .css('background-color', color);
    swatch.click(() => {
      setAnnotationColor(color);
      colorPalette.addClass('d-none');
    });
    customColorInput.before(swatch);
  });

  const customSwatch = $('<button type="button" id="custom-color-swatch" class="color-swatch" title="Custom color"></button>');
  customSwatch.click(() => {
    customColorInput.val(annotationColor);
    customColorInput[0].click();
  });
  customColorInput.before(customSwatch);

  customColorInput.on('input', function () {
    setAnnotationColor(this.value);
  });

  $('#color-button').click(function (e) {
    e.stopPropagation();
    colorPalette.toggleClass('d-none');
  });

  // Close the palette when clicking anywhere else
  $(document).click(function (e) {
    if (!$(e.target).closest('.color-picker-container').length) {
      colorPalette.addClass('d-none');
    }
  });

  // Reflect the persisted color in the toolbar
  setAnnotationColor(annotationColor);

  $("#toolbar .tool-btn[data-mode]").click(function () {
    let modeText = $(this).attr("data-mode");
    if (Mode[modeText] !== undefined) {
      setMode(Mode[modeText]); // set global mode
      $("#toolbar .tool-btn").removeClass("selected");
      $(this).addClass("selected");
    }
  });

  setTimeout(resizeCanvas, 50);
});

function getModeNameForMode(modeValue) {
  return Object.keys(Mode).find(key => Mode[key] === modeValue);
}

let canvas = new fabric.Canvas('canvas', {
  selection: true,
  width: $('#drop_area').width(),
  height: $('#drop_area').height(),
  uniformScaling: false,
  interactive: true,
  preserveObjectStacking: true,
  fireMiddleClick: true,
  fireRightClick: true,
  stopContextMenu: true,
});

fabric.Rect.prototype._controlsVisibility = {
  mt: false, // top-left
  mb: false, // top-right
  ml: false,
  mr: false
}

fabric.Polygon.prototype._controlsVisibility = {
  tl: false,
  tr: false,
  bl: false,
  br: false,
  mt: false, // top-left
  mb: false, // top-right
  ml: true,
  mr: false
}

fabric.Rect.prototype.rx = 2;
fabric.Rect.prototype.ry = 2;

//canvas.viewportTransform = [0.7, 0, 0, 0.7, -50, 50];
//let arrow = createArrow(100, 100);
//canvas.add(arrow);

canvas.on('history:append', function (event) {
  // event.json contains the serialized state of the canvas that was just added to the history
  console.log("History appended:", event.json);

  // Add your callback logic here
});

window.addEventListener('resize', resizeCanvas, false);

function resizeCanvas() {
  const dropArea = $('#drop_area');
  const w = dropArea.width() || window.innerWidth;
  const h = dropArea.height() || (window.innerHeight - ($('#toolbar').outerHeight(true) || 40) - ($('header').outerHeight(true) || 60));
  canvas.setWidth(w);
  canvas.setHeight(h);
  redrawCanvas();
}

let dropArea = document.getElementById('drop_area');

// struct for storing mode state [drawRect, drawText]. You can only be in one of these modes at once
let Mode = Object.freeze({
  "NONE": 0,
  "TEXT": 1,
  "RECT": 2,
  "OVAL": 3,
  "EDIT_TEXT": 4,
  "EDIT_RECT": 5,
  "EDIT_OVAL": 6,
  "ARROW": 7,
  "LINE": 8,
  "EMOJI": 9
});
let mode = Mode.NONE
setMode(Mode.NONE);

function setMode(newMode) {
  // set the mode
  mode = newMode;
  const modeName = getModeNameForMode(mode);
  $(".tool-btn").removeClass("selected");
  $(`.tool-btn[data-mode='${modeName}']`).addClass("selected");

  if (mode == Mode.NONE) {
    canvas.selection = true;
    canvas.selectable = true;
    // turn all objects into selectable = false
    canvas.forEachObject(function (o) {
      o.selectable = true;
    });
  } else {
    canvas.selection = false;
    canvas.selectable = false;
    // turn all objects into selectable = false
    canvas.forEachObject(function (o) {
      o.selectable = false;
    });
    if (mode != Mode.EDIT_TEXT) {
      canvas.discardActiveObject().renderAll();
    }
  }

}


// Annotation color, shared by all tools and persisted like the watermark toggle
const DEFAULT_ANNOTATION_COLOR = '#FF007F';
const ANNOTATION_COLORS = [
  '#FF007F', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE',
  '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2DCF', '#FFFFFF',
  '#C7C7CC', '#8E8E93', '#3A3A3C', '#000000'
];
let annotationColor = localStorage.getItem('annotationColor') || DEFAULT_ANNOTATION_COLOR;

function applyColorToObject(obj, color) {
  if (obj.type === 'activeSelection' || obj.type === 'group') {
    obj.forEachObject(o => applyColorToObject(o, color));
    return;
  }
  if (obj.type === 'image') {
    return;
  }
  // Filled shapes recolor their fill; outlined shapes recolor their stroke
  if (obj.type === 'polygon' || obj.type === 'textbox' || obj.type === 'i-text') {
    obj.set('fill', color);
  } else {
    obj.set('stroke', color);
  }
  obj.dirty = true;
}

function setAnnotationColor(color) {
  annotationColor = color;
  localStorage.setItem('annotationColor', color);
  $('#color-swatch-current').css('background-color', color);
  $('.color-swatch').removeClass('selected');
  $(`.color-swatch[data-color='${color.toUpperCase()}']`).addClass('selected');

  const activeObject = canvas.getActiveObject();
  if (activeObject) {
    applyColorToObject(activeObject, color);
    redrawCanvas();
  }
}

let currentlyCreatingObject = null;
let copiedObject = null;

let isDown = false;
//let arrow = null;
let origX = 0;
let origY = 0;

// Prevent default drag behaviors so drop is allowed
['dragenter', 'dragover'].forEach(eventName => {
  window.addEventListener(eventName, function (e) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, false);
});

['dragleave', 'dragend'].forEach(eventName => {
  window.addEventListener(eventName, function (e) {
    e.preventDefault();
  }, false);
});

// Handle drop globally on window
window.addEventListener('drop', function (e) {
  e.preventDefault();
  let dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    handleFiles(dt.files);
  }
}, false);

var currentFileName = 'canvas_image.png';

function handleFiles(files) {
  ([...files]).forEach(previewFile);
}

// Scale an image down so it fits within the visible canvas, preserving
// aspect ratio; small images are left at their natural size
function scaleImageToFit(oImg) {
  const maxWidth = canvas.width * 0.9;
  const maxHeight = canvas.height * 0.8;
  const scaleFactor = Math.min(1, maxWidth / oImg.width, maxHeight / oImg.height);
  if (scaleFactor < 1) {
    oImg.scale(scaleFactor);
  }
}

function previewFile(file) {
  if (file && file.name) {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    currentFileName = `${baseName || 'canvas_image'}.png`;
  }
  let reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function () {
    fabric.Image.fromURL(reader.result, function (oImg) {
      scaleImageToFit(oImg);

      oImg.set({
        left: (canvas.width - oImg.getScaledWidth()) / 2,  // Center horizontally
        top: canvas.height * .1, //(canvas.height - oImg.getScaledHeight()) / 2,  // Center vertically
        angle: 0
      }).setCoords();

      oImg.on({
        'mousedown': function () {
          canvas.setActiveObject(oImg);
        }
      });

      // Find the correct insertion index
      let insertIndex = canvas.getObjects().findIndex(obj =>
        obj.type !== 'image' && obj.type !== 'backgroundImage'
      );

      // If no non-image objects found, insert at the top
      if (insertIndex === -1) {
        insertIndex = canvas.getObjects().length;
      }

      // Insert the image at the found index
      canvas.insertAt(oImg, insertIndex);

      redrawCanvas();
    });
  }
}

function redrawCanvas() {
  // if there are objects on the canvas, remove the image-placeholder
  if (canvas.getObjects().length > 0) {
    $('#image-placeholder').addClass('d-none');
  } else {
    $('#image-placeholder').removeClass('d-none');
  }
  canvas.renderAll();
}

async function getImageWithWatermark() {
  var objects = canvas.getObjects();
  if (objects.length === 0) {
    return null;
  }

  // Preserve current zoom & pan
  const currentVpt = canvas.viewportTransform.slice();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  // Group all objects temporarily to get bounding box
  var tempGroup = new fabric.Group(objects);
  var boundingBox = tempGroup.getBoundingRect();
  tempGroup.destroy(); // Remove the temporary group

  const watermarkEnabled = localStorage.getItem('watermark') === 'true';

  let dataURL = null;
  if (watermarkEnabled) {
    dataURL = await new Promise((resolve) => {
      fabric.Image.fromURL('assets/watermark.png', function (watermarkImg) {
        var scaleFactor = 0.1;
        watermarkImg.scale(scaleFactor);

        // Position watermark at the bottom right of the cropped area
        watermarkImg.set({
          left: boundingBox.left + boundingBox.width - watermarkImg.getScaledWidth(),
          top: boundingBox.top + boundingBox.height - watermarkImg.getScaledHeight()
        });

        canvas.add(watermarkImg);
        canvas.renderAll();

        const url = canvas.toDataURL({
          format: 'png',
          quality: 1.0,
          left: boundingBox.left,
          top: boundingBox.top,
          width: boundingBox.width,
          height: boundingBox.height,
          enableRetinaScaling: true
        });

        canvas.remove(watermarkImg);
        resolve(url);
      });
    });
  } else {
    dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      left: boundingBox.left,
      top: boundingBox.top,
      width: boundingBox.width,
      height: boundingBox.height,
      enableRetinaScaling: true
    });
  }

  // Restore zoom & pan
  canvas.setViewportTransform(currentVpt);
  canvas.renderAll();

  return dataURL;
}

async function downloadCroppedWithWatermark() {
  const dataURL = await getImageWithWatermark();

  if (!dataURL) {
    $.toast("Canvas is empty")
    return;
  }

  var link = document.createElement('a');
  link.href = dataURL;
  link.download = currentFileName || 'canvas_image.png';
  link.click();
  $.toast("Downloaded")
}

async function copyImageToClipboard() {
  const dataURL = await getImageWithWatermark();

  if (!dataURL) {
    $.toast("Canvas is empty")
    return;
  }

  fetch(dataURL)
    .then(res => res.blob())
    .then(blob => {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => {
        $.toast("Copied to clipboard")
      }).catch(err => {
        $.toast("Failed to copy image")
      });
    });
}

function getScreenshotFileName() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `Screenshot_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.png`;
}

function loadScreenshotImageFromDataURL(dataURL) {
  currentFileName = getScreenshotFileName();
  fabric.Image.fromURL(dataURL, function (oImg) {
    scaleImageToFit(oImg);
    oImg.set({
      left: (canvas.width - oImg.getScaledWidth()) / 2,
      top: (canvas.height - oImg.getScaledHeight()) / 2,
      angle: 0
    }).setCoords();

    let insertIndex = canvas.getObjects().findIndex(obj =>
      obj.type !== 'image' && obj.type !== 'backgroundImage'
    );
    if (insertIndex === -1) {
      insertIndex = canvas.getObjects().length;
    }
    canvas.insertAt(oImg, insertIndex);
    redrawCanvas();
    $.toast('Screenshot captured!');
  });
}

async function captureScreenshot() {
  // Check if running in Electron environment with electronAPI bridge
  if (window.electronAPI && typeof window.electronAPI.getDesktopSources === 'function') {
    try {
      const sources = await window.electronAPI.getDesktopSources();
      if (!sources || sources.length === 0) {
        $.toast('No screens or windows found to capture');
        return;
      }

      // Populate screenshotModal with sources
      const grid = $('#screenshot-sources-grid');
      grid.empty();

      sources.forEach(source => {
        const card = $(`
          <div class="screenshot-source-card" title="${source.name}">
            <img class="screenshot-source-thumb" src="${source.thumbnail}" alt="${source.name}">
            <div class="screenshot-source-title">${source.name}</div>
          </div>
        `);
        card.click(function () {
          const modalEl = document.getElementById('screenshotModal');
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();

          loadScreenshotImageFromDataURL(source.thumbnail);
        });
        grid.append(card);
      });

      const screenshotModal = new bootstrap.Modal(document.getElementById('screenshotModal'));
      screenshotModal.show();
      return;
    } catch (e) {
      console.error('Electron desktopCapturer failed:', e);
      $.toast('Failed to capture screenshot in Electron');
      return;
    }
  }

  // Web Browser fallback (Screen Capture API as in onlineminitools.com)
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      $.toast('Screen capture is not supported in this environment');
      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.currentTime = 0;
        resolve();
      };
    });

    // Brief delay to ensure frame is painted
    await new Promise(resolve => setTimeout(resolve, 100));

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = video.videoWidth;
    offscreenCanvas.height = video.videoHeight;
    const ctx = offscreenCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    stream.getTracks().forEach(track => track.stop());

    const dataURL = offscreenCanvas.toDataURL('image/png');
    loadScreenshotImageFromDataURL(dataURL);
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      console.error('Screenshot capture failed:', err);
      $.toast('Failed to capture screenshot');
    }
  }
}

let isPanning = false;
let isSpacePressed = false;
let isAltPressed = false;
let lastPosX = 0;
let lastPosY = 0;

document.addEventListener('keydown', function (e) {
  // Alt key for panning
  if ((e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') && !$(e.target).is('input, textarea, select')) {
    if (!isAltPressed) {
      isAltPressed = true;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    }
  }

  // Space key for panning
  if (e.code === 'Space' && mode !== Mode.EDIT_TEXT && !$(e.target).is('input, textarea, select')) {
    if (!isSpacePressed) {
      isSpacePressed = true;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    }
    e.preventDefault();
    return;
  }

  // cmd + enter should exit edit mode
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (mode == Mode.EDIT_TEXT) {
      let textbox = canvas.getActiveObject()

      textbox.exitEditing();
      // select the textbox now so I can move the bounds
      // set no active object
      canvas.discardActiveObject();
      canvas.setActiveObject(textbox);
      canvas.renderAll();
    }
    setMode(Mode.NONE);
    return;
  }

  // Zoom Shortcuts: Ctrl+0, Ctrl+1, Ctrl+=, Ctrl+-
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '0' || e.key === '1') {
      e.preventDefault();
      resetZoom();
      return;
    }
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
      return;
    }
  }

  if (mode == Mode.EDIT_TEXT) {
    return;
  }
  // Bare-key hotkeys only; Ctrl/Cmd combos are handled below (otherwise
  // Ctrl+C would also trigger the full-image copy, Ctrl+A the arrow tool, etc.)
  if (!e.ctrlKey && !e.metaKey) {
    switch (e.key) {
      case '6':
      case 't':
        setMode(Mode.TEXT);
        break;
      case '4':
      case 'r':
        setMode(Mode.RECT);
        break;
      case '2':
      case 'a':
        setMode(Mode.ARROW);
        break;
      case '3':
      case 'l':
        setMode(Mode.LINE);
        break;
      case '5':
      case 'o':
        setMode(Mode.OVAL);
        break;
      case '7':
      case 'e':
        openEmojiPicker()
        setMode(Mode.EMOJI)
        break
      case 'd':
        downloadCroppedWithWatermark();
        break;
      case 'c':
        copyImageToClipboard()
      // additional cases can be added as you add more features
      case '1':
      default:
        setMode(Mode.NONE);
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    copy();
  }

  // Ctrl+V or Cmd+V for MacOS
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    // Decide what to paste from the OS clipboard contents, so an old internal
    // copy can't permanently block image pasting (#48)
    navigator.clipboard.read().then(async items => {
      for (const item of items) {
        const imageType = item.types.find(t => t === 'image/png' || t === 'image/jpeg');
        if (imageType) {
          const blob = await item.getType(imageType);
          pasteImageBlob(blob);
          return;
        }
        if (copiedObject && item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text();
          if (text === CLIPBOARD_OBJECT_MARKER) {
            paste();
            return;
          }
        }
      }
      // Nothing usable in the OS clipboard; fall back to the internal copy
      if (copiedObject) {
        paste();
      }
    }).catch(err => {
      // Clipboard read can be blocked by permissions; the internal copy still works
      if (copiedObject) {
        paste();
        return;
      }
      $.toast('Failed to paste image from clipboard');
      console.error('Failed to paste image from clipboard', err);
    })
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    canvas.undo();
    redrawCanvas()
  }

  // Ctrl+Shift+Z or Cmd+Shift+Z for MacOS
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
    canvas.redo();
    redrawCanvas()
  }

  // Ctrl+A or Cmd-A selects all objects
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    // Keep the browser from also selecting the page's text and buttons
    e.preventDefault();
    var allObjects = canvas.getObjects();

    if (allObjects.length) {
      let activeSelection = new fabric.ActiveSelection(allObjects, {
        canvas: canvas
      });
      canvas.setActiveObject(activeSelection);
      redrawCanvas();
    }
  }
});

document.addEventListener('keyup', function (e) {
  if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
    isAltPressed = false;
    if (!isSpacePressed && !isPanning) {
      canvas.defaultCursor = 'default';
      canvas.setCursor('default');
      if (mode === Mode.NONE) canvas.selection = true;
    }
  }
  if (e.code === 'Space') {
    isSpacePressed = false;
    if (!isAltPressed && !isPanning) {
      canvas.defaultCursor = 'default';
      canvas.setCursor('default');
      if (mode === Mode.NONE) canvas.selection = true;
    }
  }
});

canvas.on('mouse:wheel', function (opt) {
  let delta = opt.e.deltaY;

  // Shift + Wheel -> Horizontal pan
  if (opt.e.shiftKey && !opt.e.ctrlKey && !opt.e.metaKey) {
    canvas.relativePan(new fabric.Point(-delta, 0));
    opt.e.preventDefault();
    opt.e.stopPropagation();
    return;
  }

  let zoom = canvas.getZoom();
  if (opt.e.ctrlKey || opt.e.metaKey) {
    // Smooth pinch / Ctrl+Wheel zoom
    zoom *= 0.993 ** delta;
  } else {
    // Standard mouse wheel zoom
    zoom *= delta > 0 ? 0.88 : 1.14;
  }

  zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
});

// Written to the OS clipboard on copy so paste can tell whether the internal
// copy or an image copied in another app is the most recent thing copied
const CLIPBOARD_OBJECT_MARKER = 'pinkarrows:copied-object';

function copy() {
  var activeObject = canvas.getActiveObject();

  if (activeObject) {
    copiedObject = activeObject;
    navigator.clipboard.writeText(CLIPBOARD_OBJECT_MARKER).catch(() => {});
  }
}

function pasteImageBlob(blob) {
  const reader = new FileReader();
  reader.onload = function(event) {
    fabric.Image.fromURL(event.target.result, function(oImg) {
      scaleImageToFit(oImg);

      oImg.set({
        left: (canvas.width - oImg.getScaledWidth()) / 2,
        top: canvas.height * .1,
        angle: 0
      }).setCoords();

      // Find insertion index
      let insertIndex = canvas.getObjects().findIndex(obj =>
        obj.type !== 'image' && obj.type !== 'backgroundImage'
      );

      // if no non-image objects found, insert at the top
      if (insertIndex === -1) {
        insertIndex = canvas.getObjects().length;
      }

      // Insert the image at the found index
      canvas.insertAt(oImg, insertIndex);
      redrawCanvas();
      $.toast('Image pasted from clipboard');
    });
  };
  reader.readAsDataURL(blob);
}

function paste() {
  if (copiedObject) {
    copiedObject.clone(function (clonedObj) {
      // Ensure the cloned object is an instance of CustomTextbox
      if (clonedObj instanceof fabric.Textbox) {
        clonedObj = new CustomTextbox(clonedObj.text, clonedObj.toObject());
      }
      canvas.add(clonedObj);
      clonedObj.set({
        left: clonedObj.left + 10, // You can adjust these values for the paste position
        top: clonedObj.top + 10,
        evented: true
      });
      copiedObject = clonedObj;

      // Make sure the newly added object is selected
      canvas.setActiveObject(clonedObj);
      canvas.requestRenderAll();
    });
  }
}


canvas.on('mouse:down', function (options) {
  const e = options.e;
  // Middle click (button 1 or which 2 or buttons 4), Alt+Drag, or Space+Drag
  const isMiddleClick = (e.button === 1 || e.which === 2 || (e.buttons && (e.buttons & 4)));
  const isAltDrag = (e.altKey || isAltPressed);
  const isSpaceDrag = isSpacePressed;

  if (isMiddleClick || isAltDrag || isSpaceDrag) {
    isPanning = true;
    canvas.selection = false;
    lastPosX = e.clientX;
    lastPosY = e.clientY;
    canvas.setCursor('grabbing');
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  isDown = true;
  let pointer = canvas.getPointer(options.e);
  origX = pointer.x;
  origY = pointer.y;
  if (mode == Mode.TEXT) {
    if (options.target && options.target.selectable) {
      return;
    }
    let pointer = canvas.getPointer(options.e);
    let { fontFamily, fontWeight, strokeWidth } = getTextSettings();
    let text = new CustomTextbox('text', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: fontFamily,
      fill: annotationColor,
      stroke: '#ffffff', // White border
      strokeWidth: strokeWidth,
      strokeLineJoin: 'round',
      paintFirst: 'stroke',
      shadow: 'rgba(0,0,0,0.3) 2px 2px 2px',  // Black shadow
      fontWeight: fontWeight,
      fixedWidth: 250,
      width: 250
    });

    // text.on('editing:entered', function () {
    //   setMode(Mode.EDIT_TEXT);
    // });

    // text.on('editing:exited', function () {
    //   setMode(Mode.NONE);
    // });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    // highlight the text
    text.selectAll();
    redrawCanvas();
  } else if (mode == Mode.RECT) {
    console.log('attempting to draw rect')
    let pointer = canvas.getPointer(options.e);
    origX = pointer.x;
    origY = pointer.y;
    let rect = new fabric.Rect({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      width: 50,
      height: 50,
      angle: 0,
      fill: 'rgba(255,255,255,0)',
      stroke: annotationColor,
      strokeWidth: 4,
      selectable: true,
      hasBorders: false,
      hasControls: true,
      strokeUniform: true,
    })
    currentlyCreatingObject = rect;
    console.log(rect)

    // detect rect edit
    rect.on('selected', function () {
      //mode = Mode.EDIT_RECT;
      console.log("mode is EDIT_RECT")
    });

    canvas.add(rect);
    redrawCanvas();
  } else if (mode == Mode.OVAL) {
    console.log('attempting to draw oval')
    let pointer = canvas.getPointer(options.e);
    origX = pointer.x;
    origY = pointer.y;
    let oval = new fabric.Ellipse({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      rx: 25,
      ry: 25,
      angle: 0,
      fill: 'rgba(255,255,255,0)',
      stroke: annotationColor,
      strokeWidth: 4,
      selectable: true,
      hasBorders: false,
      hasControls: true,
      strokeUniform: true,
    })
    currentlyCreatingObject = oval;
    console.log(oval)

    // detect oval edit
    oval.on('selected', function () {
      //mode = Mode.EDIT_OVAL;
      console.log("mode is EDIT_OVAL")
    });

    canvas.add(oval);
    redrawCanvas();
  } else if (mode == Mode.ARROW) {

    let arrow = createArrow(origX, origY, annotationColor);
    canvas.add(arrow);
    currentlyCreatingObject = arrow;

    redrawCanvas();
  } else if (mode == Mode.LINE) {
    let line = new fabric.Line([origX, origY, origX, origY], {
      stroke: annotationColor,
      strokeWidth: 4,
      selectable: true,
      hasBorders: false,
      hasControls: true,
      strokeLineCap: 'round',
      strokeUniform: true,
    });

    canvas.add(line);
    currentlyCreatingObject = line;
    redrawCanvas();
  } else if (mode == Mode.NONE) {

  }
});

function getBoundsForPointer(pointer) {
  let x = pointer.x;
  let y = pointer.y;
  let bounds = {
    left: Math.min(x, origX),
    top: Math.min(y, origY),
    width: Math.abs(x - origX),
    height: Math.abs(y - origY)
  };
  //bounds.width = bounds.width < 10 ? 10 : bounds.width;
  //bounds.height = bounds.height < 10 ? 10 : bounds.height;
  return bounds;
}

canvas.on('mouse:move', function (o) {
  if (isPanning) {
    const e = o.e;
    const deltaX = e.clientX - lastPosX;
    const deltaY = e.clientY - lastPosY;
    canvas.relativePan(new fabric.Point(deltaX, deltaY));
    lastPosX = e.clientX;
    lastPosY = e.clientY;
    canvas.setCursor('grabbing');
    return;
  }

  if (!isDown) return;
  let pointer = canvas.getPointer(o.e);
  if (mode == Mode.RECT) {
    if (currentlyCreatingObject) {
      let bounds = getBoundsForPointer(pointer)
      currentlyCreatingObject.set({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      });
    }
  } else if (mode == Mode.OVAL) {
    if (currentlyCreatingObject) {
      let bounds = getBoundsForPointer(pointer)
      currentlyCreatingObject.set({
        left: bounds.left,
        top: bounds.top,
        rx: bounds.width/2,
        ry: bounds.height/2
      });
    }
  } else if (mode == Mode.ARROW) {
    if (currentlyCreatingObject) {
      let arrow = currentlyCreatingObject
      setArrowHeadPoint(arrow, pointer.x, pointer.y)
    }
  } else if (mode == Mode.LINE) {
    if (currentlyCreatingObject) {
      currentlyCreatingObject.set({ x2: pointer.x, y2: pointer.y });
      currentlyCreatingObject.setCoords();
    }
  }

  //arrow.set({ x2: pointer.x, y2: pointer.y });
  redrawCanvas();
});

canvas.on('mouse:up', function (o) {
  if (isPanning) {
    isPanning = false;
    if (isSpacePressed || isAltPressed) {
      canvas.setCursor('grab');
    } else {
      canvas.setCursor('default');
      if (mode === Mode.NONE) {
        canvas.selection = true;
      }
    }
    return;
  }

  isDown = false;
  if (mode == Mode.RECT || mode == Mode.OVAL) {
    canvas.setActiveObject(canvas.item(canvas.getObjects().length - 1));
    currentlyCreatingObject = null;
    setMode(Mode.NONE);
  } else if (mode == Mode.ARROW) {
    canvas.setActiveObject(canvas.item(canvas.getObjects().length - 1))
    currentlyCreatingObject = null;
    setMode(Mode.NONE);
  } else if (mode == Mode.LINE) {
    const line = currentlyCreatingObject;
    if (line && !hasDistinctEndpoints(line.x1, line.y1, line.x2, line.y2)) {
      canvas.remove(line);
      $.toast("Line endpoints must be different");
      currentlyCreatingObject = null;
      redrawCanvas();
      return;
    }
    canvas.setActiveObject(canvas.item(canvas.getObjects().length - 1))
    currentlyCreatingObject = null;
    setMode(Mode.NONE);
  }
  redrawCanvas();
});


// Keyboard event to delete active object
document.addEventListener('keydown', function (event) {
  if (event.key == 'Delete' || event.key == 'Backspace') {
    let activeObjects = canvas.getActiveObjects();
    if (activeObjects.length == 1) {
      let activeObject = activeObjects[0];
      if (activeObject.type == 'textbox' && mode == Mode.EDIT_TEXT) {
        return;
      }
    }
    canvas.remove(...activeObjects);
    canvas.discardActiveObject();
    redrawCanvas();
  }
});
canvas.on('selection:created', syncTextControlsFromSelection);
canvas.on('selection:updated', syncTextControlsFromSelection);
