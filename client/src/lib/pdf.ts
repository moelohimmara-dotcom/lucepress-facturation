export async function downloadPdfFromElement(elementId: string, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Le document à exporter est introuvable.");

  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  let remainingHeight = imageHeight;
  let position = 0;

  pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight, undefined, "FAST");
  remainingHeight -= pageHeight;
  while (remainingHeight > 0) {
    position = remainingHeight - imageHeight;
    pdf.addPage();
    pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight, undefined, "FAST");
    remainingHeight -= pageHeight;
  }
  pdf.save(`${filename}.pdf`);
}
