import { fileTypeFromFile } from 'file-type';



export async function hasAllowedFileType(
  filePath: string,
  allowedMimeTypes: string[],
): Promise<boolean> {
  const fileType = await fileTypeFromFile(filePath);

  return (
    fileType !== undefined &&
    allowedMimeTypes.includes(fileType.mime)
  );
}
