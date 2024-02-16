const fs = require('fs');
const path = require('path');
const { v4 } = require("uuid");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");


async function asPDF({ fullFilePath = "", filename = "" }) {

  outputdir = '/Users/User/Desktop/anything-llm/collector/processSingleFile/convert/images'
  exportImageFromPDF(fullFilePath, outputdir)

  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  const docs = await pdfLoader.load();
  for (const doc of docs) {
    console.log(
      `-- Parsing content from pg ${
        doc.metadata?.loc?.pageNumber || "unknown"
      } --`
    );
    if (!doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
  }


  if (!pageContent.length) {
    console.error(`Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  
  let base64Images = [];

  // Read the directory
  fs.readdir(outputdir, (err, files) => {
    if (err) {
      console.error('Error reading the directory', err);
      return;
    }

    // Filter PNG files and process each
    files.filter(file => path.extname(file).toLowerCase() === '.png').forEach(file => {
      const filePath = path.join(outputdir, file);

      // Read the file and convert to Base64
      const fileContent = fs.readFileSync(filePath);
      const base64String = Buffer.from(fileContent).toString('base64');
      base64Images.push(base64String);

      // Delete the file
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting the file', err);
        } else {
          console.log(`${file} has been deleted`);
        }
      });
    });

    // Log or use the Base64 strings as needed
    console.log(base64Images);
    // For example, you can return this list from a function call or write it to a file
  });

  const content = pageContent.join("");
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: docs[0]?.metadata?.pdf?.info?.Title || filename,
    docAuthor: docs[0]?.metadata?.pdf?.info?.Creator || "no author found",
    description: "No description found.",
    docSource: "pdf file uploaded by the user.",
    chunkSource: "",
    published: createdDate(fullFilePath),
    wordCount: content.split(" ").length,
    pageContent: content,
    images: base64Images,
    token_count_estimate: tokenizeString(content).length,
  };

  const document = writeToServerDocuments(
    data,
    `${slugify(filename)}-${data.id}`
  );
  trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [document] };
}

function exportImageFromPDF(filepath, outputdir) {
  try {
      const pdfExportImagesModule = import('pdf-export-images');
      const exportImages = pdfExportImagesModule.exportImages;

      const images = exportImages(filepath, outputdir);
      console.log('Exported', images.length, 'images');
  } catch (error) {
      console.error(error);
  }
}


module.exports = asPDF;
