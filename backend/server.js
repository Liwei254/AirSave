// ==================== CORE ====================
dotenv.config();
connectDB();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://airsave-1.onrender.com"
  ],
  credentials: true
}));

app.use(helmet());
app.use(morgan("combined"));

// ==================== ROUTES ====================
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);

// ==================== ROOT ====================
app.get("/", (req, res) => {
  res.json({
    message: "AirSave API",
    status: "running"
  });
});

// ==================== ERROR HANDLING ====================
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});