import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import BlogPage from "@/pages/blog";
import AboutPage from "@/pages/about";
import DatabaseUpdatePage from "@/pages/database-update";
import ProjectPage from "@/pages/ProjectPage";

function App() {
  return (
    <>
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<DocsPage />} path="/docs" />
        <Route element={<PricingPage />} path="/pricing" />
        <Route element={<BlogPage />} path="/blog" />
        <Route element={<AboutPage />} path="/about" />
        <Route element={<DatabaseUpdatePage />} path="/database-update" />
        <Route element={<ProjectPage />} path="/projects/:id" />
      </Routes>
    </>
  );
}

export default App;
