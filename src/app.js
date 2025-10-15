// src/app.js
import { Router } from "express";
import authRoutes from "./routes/auth.routes.js";
import booksRoutes from "./routes/books.routes.js";

const router = Router();

router.use(authRoutes);
router.use("/api/libros", booksRoutes);

// página base de texto simple (opcional)
router.get("/api", (req, res) => res.send("API del sistema de stock de libros funcionando"));

export default router;
