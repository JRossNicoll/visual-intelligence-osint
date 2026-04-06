"""CLIP-based embedding module for visual and text embeddings.

Uses OpenCLIP for generating embeddings that enable:
- Cross-session identity matching
- Text-based target definition matching
- Visual similarity search
"""

import logging
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class CLIPEmbedder:
    """Generates CLIP embeddings for images and text.

    Uses OpenCLIP for cross-modal embeddings, enabling:
    - Comparing images to text descriptions (target matching)
    - Comparing images to images (re-identification)
    - Semantic similarity search
    """

    def __init__(
        self,
        model_name: str = "ViT-B-32",
        pretrained: str = "openai",
        device: str = "cpu",
    ) -> None:
        self.model_name = model_name
        self.pretrained = pretrained
        self.device = device
        self._model = None
        self._preprocess = None
        self._tokenizer = None
        self._loaded = False

    def load(self) -> None:
        """Load the CLIP model."""
        try:
            import open_clip
            import torch

            logger.info(
                "Loading CLIP model: %s (%s) on device: %s",
                self.model_name,
                self.pretrained,
                self.device,
            )

            self._model, _, self._preprocess = open_clip.create_model_and_transforms(
                self.model_name,
                pretrained=self.pretrained,
                device=self.device,
            )
            self._tokenizer = open_clip.get_tokenizer(self.model_name)
            self._model.eval()
            self._loaded = True
            logger.info("CLIP model loaded successfully")
        except Exception as e:
            logger.error("Failed to load CLIP model: %s", e)
            raise

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def embedding_dim(self) -> int:
        """Get the embedding dimension."""
        if self.model_name.startswith("ViT-B"):
            return 512
        if self.model_name.startswith("ViT-L"):
            return 768
        if self.model_name.startswith("ViT-H"):
            return 1024
        return 512

    def embed_image(self, image: Image.Image) -> Optional[list[float]]:
        """Generate an embedding for a PIL Image.

        Args:
            image: PIL Image (RGB)

        Returns:
            Normalized embedding vector as list of floats
        """
        if not self._loaded or self._model is None or self._preprocess is None:
            logger.warning("CLIP model not loaded, returning None")
            return None

        try:
            import torch

            with torch.no_grad():
                processed = self._preprocess(image).unsqueeze(0).to(self.device)
                features = self._model.encode_image(processed)
                features = features / features.norm(dim=-1, keepdim=True)
                return features.cpu().numpy().flatten().tolist()
        except Exception as e:
            logger.error("Error generating image embedding: %s", e)
            return None

    def embed_image_crop(
        self,
        frame: np.ndarray,
        bbox: tuple[float, float, float, float],
    ) -> Optional[list[float]]:
        """Generate embedding for a cropped region of a frame.

        Args:
            frame: BGR numpy array (H, W, C)
            bbox: (x1, y1, x2, y2) bounding box

        Returns:
            Normalized embedding vector
        """
        try:
            import cv2

            x1, y1, x2, y2 = [int(v) for v in bbox]
            h, w = frame.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)

            if x2 <= x1 or y2 <= y1:
                return None

            crop = frame[y1:y2, x1:x2]
            rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_crop)
            return self.embed_image(pil_image)
        except Exception as e:
            logger.error("Error generating crop embedding: %s", e)
            return None

    def embed_images_batch(self, images: list[Image.Image]) -> list[Optional[list[float]]]:
        """Generate embeddings for a batch of images.

        Args:
            images: List of PIL Images (RGB)

        Returns:
            List of normalized embedding vectors
        """
        if not self._loaded or self._model is None or self._preprocess is None:
            return [None] * len(images)

        try:
            import torch

            with torch.no_grad():
                processed = torch.stack(
                    [self._preprocess(img) for img in images]
                ).to(self.device)
                features = self._model.encode_image(processed)
                features = features / features.norm(dim=-1, keepdim=True)
                return [f.cpu().numpy().tolist() for f in features]
        except Exception as e:
            logger.error("Error in batch image embedding: %s", e)
            return [None] * len(images)

    def embed_text(self, text: str) -> Optional[list[float]]:
        """Generate an embedding for a text description.

        Args:
            text: Text description (e.g., "white Toyota Hilux")

        Returns:
            Normalized embedding vector
        """
        if not self._loaded or self._model is None or self._tokenizer is None:
            logger.warning("CLIP model not loaded, returning None")
            return None

        try:
            import torch

            with torch.no_grad():
                tokens = self._tokenizer([text]).to(self.device)
                features = self._model.encode_text(tokens)
                features = features / features.norm(dim=-1, keepdim=True)
                return features.cpu().numpy().flatten().tolist()
        except Exception as e:
            logger.error("Error generating text embedding: %s", e)
            return None

    def embed_texts_batch(self, texts: list[str]) -> list[Optional[list[float]]]:
        """Generate embeddings for a batch of text descriptions."""
        if not self._loaded or self._model is None or self._tokenizer is None:
            return [None] * len(texts)

        try:
            import torch

            with torch.no_grad():
                tokens = self._tokenizer(texts).to(self.device)
                features = self._model.encode_text(tokens)
                features = features / features.norm(dim=-1, keepdim=True)
                return [f.cpu().numpy().tolist() for f in features]
        except Exception as e:
            logger.error("Error in batch text embedding: %s", e)
            return [None] * len(texts)

    @staticmethod
    def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
        """Compute cosine similarity between two embedding vectors."""
        a = np.array(vec1, dtype=np.float32)
        b = np.array(vec2, dtype=np.float32)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))
