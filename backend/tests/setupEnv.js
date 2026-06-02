process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://airsave:airsave_password@localhost:5432/airsave_test";
process.env.JWT_SECRET = "airsave-test-jwt-secret";
process.env.JWT_EXPIRE = "15m";
process.env.JWT_REFRESH_EXPIRE = "7d";
process.env.CLIENT_URLS = "http://localhost:5173";
