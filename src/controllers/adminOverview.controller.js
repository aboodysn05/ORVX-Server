import * as adminOverviewService from "../services/adminOverview.service.js";

export async function getAdminOverviewController(req, res) {
  const overview = await adminOverviewService.getAdminOverview();
  res.json({ overview });
}
