import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404: Page not found");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-6">Страница не найдена</p>
      <button
        onClick={() => navigate("/")}
        className="px-4 py-2 rounded bg-primary text-primary-foreground"
      >
        На главную
      </button>
    </div>
  );
};

export default NotFound;
