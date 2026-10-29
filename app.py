
import os
import uuid
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
import numpy as np
import tensorflow as tf

app = Flask(__name__)

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "Model.keras")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
IMAGE_SIZE = (256, 256)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# IMPORTANT:
# Replace these with the exact order printed by:
# print(train_dataset.class_names)
CLASS_NAMES = [
    "glioma",
    "meningioma",
    "notumor",
    "pituitary",
]

# Load model once
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

if model.output_shape[-1] != len(CLASS_NAMES):
    raise ValueError(
        f"Model outputs {model.output_shape[-1]} classes, "
        f"but CLASS_NAMES contains {len(CLASS_NAMES)}."
    )


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def predict_mri(image_path):
    # Match the original training pipeline:
    # RGB images, 256x256, pixel values in the 0-255 range.
    with Image.open(image_path) as image:
        image = image.convert("RGB")
        image = image.resize(IMAGE_SIZE)

        image_array = np.asarray(image, dtype=np.float32)

    image_array = np.expand_dims(image_array, axis=0)

    predictions = model.predict(image_array, verbose=0)[0]

    predicted_index = int(np.argmax(predictions))

    results = [
        {
            "class_name": CLASS_NAMES[i],
            "confidence": round(float(predictions[i]) * 100, 2),
        }
        for i in range(len(CLASS_NAMES))
    ]

    results.sort(key=lambda item: item["confidence"], reverse=True)

    return {
        "prediction": CLASS_NAMES[predicted_index],
        "confidence": round(
            float(predictions[predicted_index]) * 100, 2
        ),
        "results": results,
    }


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    if "mri_image" not in request.files:
        return jsonify({"error": "Please select an MRI image."}), 400

    file = request.files["mri_image"]

    if not file or file.filename == "":
        return jsonify({"error": "No image was selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": "Unsupported file. Upload a JPG, JPEG, or PNG image."
        }), 400

    # Use a generated filename to avoid filename collisions.
    extension = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{extension}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    try:
        file.save(filepath)

        output = predict_mri(filepath)
        output["image_url"] = f"/static/uploads/{filename}"

        return jsonify(output)

    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify({
            "error": "The uploaded file is not a valid image."
        }), 400

    except Exception:
        app.logger.exception("MRI prediction failed")
        return jsonify({
            "error": "Prediction failed. Check the server logs."
        }), 500

    finally:
        # Delete the uploaded image after inference.
        if os.path.exists(filepath):
            os.remove(filepath)


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "Image is too large. Maximum upload size is 10 MB."
    }), 413


if __name__ == "__main__":
    app.run(debug=True)
