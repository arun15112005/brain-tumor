
const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("mriImage");
const dropZone = document.getElementById("dropZone");
const previewImage = document.getElementById("previewImage");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeButton = document.getElementById("removeImage");
const analyzeButton = document.getElementById("analyzeButton");
const buttonText = document.getElementById("buttonText");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultState = document.getElementById("resultState");
const errorMessage = document.getElementById("errorMessage");

const predictionName = document.getElementById("predictionName");
const confidenceValue = document.getElementById("confidenceValue");
const confidenceBar = document.getElementById("confidenceBar");
const classScores = document.getElementById("classScores");
const resetButton = document.getElementById("resetButton");

let selectedFile = null;
let previewUrl = null;
let busy = false;

const allowedTypes = ["image/jpeg", "image/png"];
const maxFileSize = 10 * 1024 * 1024;

function formatSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function hideResults() {
    emptyState.classList.remove("hidden");
    loadingState.classList.add("hidden");
    resultState.classList.add("hidden");
    errorMessage.classList.add("hidden");
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function clearPreview() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    previewImage.removeAttribute("src");
    previewImage.classList.add("hidden");
    uploadPlaceholder.classList.remove("hidden");
    fileInfo.classList.add("hidden");
}

function setFile(file) {
    errorMessage.classList.add("hidden");

    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
        showError("Please choose a valid JPG, JPEG, or PNG image.");
        return;
    }

    if (file.size > maxFileSize) {
        showError("The image exceeds the 10 MB upload limit.");
        return;
    }

    selectedFile = file;
    clearPreview();

    previewUrl = URL.createObjectURL(file);
    previewImage.src = previewUrl;
    previewImage.classList.remove("hidden");
    uploadPlaceholder.classList.add("hidden");

    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.classList.remove("hidden");

    analyzeButton.disabled = false;
    buttonText.textContent = "Analyze MRI image";

    hideResults();
}

fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
        setFile(fileInput.files[0]);
    }
});

["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add("dragging");
    });
});

["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove("dragging");
    });
});

dropZone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];

    if (file) {
        setFile(file);
    }
});

removeButton.addEventListener("click", () => {
    if (busy) return;

    selectedFile = null;
    fileInput.value = "";
    clearPreview();
    hideResults();

    analyzeButton.disabled = true;
    buttonText.textContent = "Analyze MRI image";
});

function renderResults(data) {
    emptyState.classList.add("hidden");
    loadingState.classList.add("hidden");
    errorMessage.classList.add("hidden");
    resultState.classList.remove("hidden");

    predictionName.textContent = data.prediction;
    confidenceValue.textContent = `${data.confidence.toFixed(2)}%`;
    confidenceBar.style.width = `${Math.min(100, Math.max(0, data.confidence))}%`;

    classScores.replaceChildren();

    data.results.forEach(item => {
        const scoreItem = document.createElement("div");
        scoreItem.className = "score-item";

        const label = document.createElement("div");
        label.className = "score-label";

        const name = document.createElement("span");
        name.textContent = item.class_name.replaceAll("_", " ");

        const percentage = document.createElement("span");
        percentage.textContent = `${item.confidence.toFixed(2)}%`;

        const track = document.createElement("div");
        track.className = "score-track";

        const fill = document.createElement("div");
        fill.className = "score-fill";
        fill.style.width = `${Math.min(100, Math.max(0, item.confidence))}%`;

        label.append(name, percentage);
        track.appendChild(fill);
        scoreItem.append(label, track);
        classScores.appendChild(scoreItem);
    });
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedFile || busy) return;

    busy = true;
    analyzeButton.disabled = true;
    buttonText.textContent = "Analyzing...";
    errorMessage.classList.add("hidden");
    emptyState.classList.add("hidden");
    resultState.classList.add("hidden");
    loadingState.classList.remove("hidden");

    try {
        const formData = new FormData();
        formData.append("mri_image", selectedFile);

        const response = await fetch("/predict", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to analyze this image.");
        }

        renderResults(data);

    } catch (error) {
        loadingState.classList.add("hidden");
        emptyState.classList.remove("hidden");
        showError(
            error.message || "Could not connect to the server. Try again."
        );

    } finally {
        busy = false;
        analyzeButton.disabled = !selectedFile;
        buttonText.textContent = "Analyze MRI image";
    }
});

resetButton.addEventListener("click", () => {
    if (busy) return;

    selectedFile = null;
    fileInput.value = "";
    clearPreview();
    hideResults();

    analyzeButton.disabled = true;
    buttonText.textContent = "Analyze MRI image";
    window.scrollTo({ top: 0, behavior: "smooth" });
});
