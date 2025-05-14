import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
admin.initializeApp();
import { FieldValue } from "firebase-admin/firestore";
import { onObjectFinalized, StorageEvent } from "firebase-functions/v2/storage";
// import * as Jimp from "jimp";
import * as fs from 'fs/promises';
//  import jimp, { read, loadFont, FONT_SANS_32_BLACK, AUTO } from 'jimp';
import Jimp from 'jimp';

interface CreateUserData {
    email: string;
    password: string;
    displayName: string;
    role: string;
}

interface PhotoEntry {
    id?: string;
    url: string;
    fileName?: string;
    uploadedAt?: admin.firestore.Timestamp;
    caption?: string | null;
    wasTakenByCamera?: boolean;
    processedUrl?: string;
    processedAt?: admin.firestore.Timestamp;
}

interface PathInfo {
    taskId: string | undefined;
    photoId: string | undefined;
    fileName: string | undefined;
}

function extractInfoFromPath(filePath: string): PathInfo {
    const parts = filePath.split('/');
    if (parts.length === 4 && parts[0] === 'task_photos') {
        return {
            taskId: parts[1],
            photoId: parts[2],
            fileName: parts[3],
        };
    }
    return {
        taskId: undefined, photoId: undefined, fileName: undefined 
    };
}

const MAX_FIRESTORE_RETRIES = 3;
const FIRESTORE_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void>{
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const processUploadedImage = onObjectFinalized(
    {
    bucket: "kensyu10093.firebasestorage.app",
    region: "asia-northeast1",
    memory: "512MiB",
},
    async (event: StorageEvent ) => {
            if (admin.apps.length === 0) {
                admin.initializeApp();
            }
            const db =admin.firestore();
            const storage = admin.storage();
        
        const fileBucket = event.data.bucket;
        const filePath = event.data.name;
        const contentType = event.data.contentType;
        const metageneration = event.data.metageneration;

        logger.info("New file uploaded to Storage:",{
            bucket: fileBucket,
            path: filePath,
            type: contentType,
            metageneration: metageneration,

        });

        if (!contentType || !contentType.startsWith("image/")) {
            logger.log("Not an image, slipping processing:", filePath);
        return null;
        }

        if (filePath.includes("_processed.")) {
            logger.log("Image already processed, skipping:", filePath);
            return null;
        }

        const pathInfo = extractInfoFromPath(filePath);
        if (!pathInfo.taskId || !pathInfo.photoId || !pathInfo.fileName) {
            logger.error("Coulod not extract necessary info from filePath", {filePath});
            return null;
        }
        logger.info("Extracted path info:", pathInfo);

        let dailyLogDocRef: admin.firestore.DocumentReference | undefined;
        let photoEntryToUpdate: PhotoEntry | undefined;
        let photoEntryIndex = -1;
        let originalPhotosArray: PhotoEntry[] = []; 
        let proceedWithImageProcessing = false;

        try { // Firestoreアクセスとリトライのためのtryブロック開始
            for (let attempt = 0; attempt <= MAX_FIRESTORE_RETRIES; attempt++) {
                const dailyLogsSnapshot = await db.collection('Tasks').doc(pathInfo.taskId).collection('DailyLogs').get();
    
                if (!dailyLogsSnapshot.empty) {
                    for (const doc of dailyLogsSnapshot.docs) {
                        const logData = doc.data();
                        if (logData && logData.photos && Array.isArray(logData.photos)) {
                            const photos = logData.photos as PhotoEntry[];
                            const foundIndex = photos.findIndex((p: PhotoEntry) => p.id === pathInfo.photoId);
                            if (foundIndex !== -1) {
                                dailyLogDocRef = doc.ref;
                                originalPhotosArray = [...photos];
                                photoEntryToUpdate = originalPhotosArray[foundIndex];
                                photoEntryIndex = foundIndex;
                                logger.info(`Found PhotoEntry (attempt ${attempt}) in DailyLog:`, { dailyLogId: doc.id, photoId: pathInfo.photoId, index: photoEntryIndex });
                                break; // PhotoEntry が見つかったので for ループを抜ける
                            }
                        }
                    }
                }
    
                if (photoEntryToUpdate) {
                    break; // PhotoEntry が見つかったのでリトライのループも抜ける
                }
    
                if (attempt < MAX_FIRESTORE_RETRIES) {
                    logger.info(`PhotoEntry not found, attempt ${attempt + 1}/${MAX_FIRESTORE_RETRIES + 1}. Retrying in ${FIRESTORE_RETRY_DELAY_MS}ms...`, { photoId: pathInfo.photoId });
                    await sleep(FIRESTORE_RETRY_DELAY_MS);
                } else {
                    logger.warn(`PhotoEntry not found after ${MAX_FIRESTORE_RETRIES + 1} attempts. Giving up.`, { photoId: pathInfo.photoId, taskId: pathInfo.taskId });
                }
            }
        } catch (dbError: unknown) {
            logger.error("Error accessing Firestore to find PhotoEntry (with retries):", dbError, { taskId: pathInfo.taskId, photoId: pathInfo.photoId });
            return null; // Firestoreアクセス中にエラーがあれば処理終了
        }

        if (!dailyLogDocRef || !photoEntryToUpdate) {
            logger.warn("PhotoEntry not found in any DailyLog after checking all logs for photoId (outside try-catch).", { photoId: pathInfo.photoId, taskId: pathInfo.taskId });
            return null; 
        }

        if (photoEntryToUpdate.wasTakenByCamera === true) {
            logger.info("Photo was taken by camera, setting flag to proceed with image processing.", { filePath, photoId: pathInfo.photoId });
            proceedWithImageProcessing = true;
        } else {
            logger.info("Photo was NOT taken by camera, image processing will be skipped.", { filePath, photoId: pathInfo.photoId });
        }
        
        if (!proceedWithImageProcessing) {
            logger.info("Image processing skipped based on proceedWithImageProcessing flag.", { photoId: pathInfo.photoId });
            return null;
        }
        
        

        const bucket = storage.bucket(fileBucket);
        const originalFile = bucket.file(filePath);
        const fileName = filePath.split("/").pop();
        if (!fileName) {
            logger.error("Could not extract fileName from filePath", {filePath});
            return null;
        }
        const tempFilePath = `/tmp/${fileName}`;

        try {
            await originalFile.download({ destination: tempFilePath });
            logger.info("Image downloaded to temporary location:", tempFilePath);

            const image = await Jimp.read(tempFilePath);
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

            const currentDate = new Date(); 
            const options: Intl.DateTimeFormatOptions = {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Tokyo',
            }

            let dateTimeStringForOverlayJST = "DATE_ERROR";
            try {
                const formatter = new Intl.DateTimeFormat('ja-Jp', options);
                const parts = formatter.formatToParts(currentDate);
                const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
                const dateString =`${getPart('year')}/${getPart('month')}/${getPart('day')}` ;
                const timeString =`${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
                dateTimeStringForOverlayJST = `${dateString} ${timeString}`;
            } catch (error) {
                logger.error("Error formatting date with Intl.DateTimeFormat", error);
                dateTimeStringForOverlayJST = 
                `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}` +
                `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}(UTC_fallback)`;
            }

            const textToPrint = `${dateTimeStringForOverlayJST}`;

            image.print(
                font,
                10,
                10,
                textToPrint,
            );

            logger.info("Text overlaid on image:", {text: textToPrint});

            const extension = filePath.substring(filePath.lastIndexOf('.'));
            const baseName = filePath.substring(0, filePath.lastIndexOf('.'));
            const processedFileName = `${baseName}_processed${extension}`;

            const processedFile = bucket.file(processedFileName);

            const imageBuffer = await image.getBufferAsync(image.getMIME());
            await processedFile.save(imageBuffer, {
                metadata: { contentType: contentType },
            });

            logger.info("Processed image uploaded to Storage:", processedFileName);

            logger.info("Before attempting Firestore data modification (PhotoEntry):", {
                dailyLogDocRefPath: dailyLogDocRef?.path,
                photoEntryIndex: photoEntryIndex,
                originalPhotosArrayLength: originalPhotosArray.length,
                isPhotoEntryInArrayValid: !!(originalPhotosArray && photoEntryIndex >= 0 && photoEntryIndex < originalPhotosArray.length && originalPhotosArray[photoEntryIndex]),
                photoEntryIdToModify: photoEntryToUpdate?.id,
                photoIdFromPath: pathInfo.photoId
            });

            if (dailyLogDocRef && photoEntryIndex !== -1 && originalPhotosArray[photoEntryIndex]) {
                const publicUrl = processedFile.publicUrl();
                originalPhotosArray[photoEntryIndex].url = publicUrl;
                originalPhotosArray[photoEntryIndex].processedUrl = publicUrl; 
                originalPhotosArray[photoEntryIndex].processedAt = admin.firestore.Timestamp.fromDate(new Date()); 

                await dailyLogDocRef.update({ photos: originalPhotosArray });
                logger.info("Firestore PhotoEntry data modified successfully with processed image URL.", { dailyLogId: dailyLogDocRef.id, photoId: pathInfo.photoId, newUrl: publicUrl });
            } else {
                logger.error("Critical: dailyLogDocRef, photoEntryIndex, or originalPhotosArray was invalid at the point of Firestore modification.", 
                    { dailyLogDocRefExists: !!dailyLogDocRef, photoEntryIndex, photoEntryExistsInArray: !!(originalPhotosArray && originalPhotosArray[photoEntryIndex]), photoIdFromPath: pathInfo.photoId });
            }

        } catch (error) {
            logger.error("Error processing image:", error, { path: filePath });
        } finally {
            if (tempFilePath) {
                try {
                    await fs.unlink(tempFilePath);
                    logger.info("Temporary file deleted:", tempFilePath);
                } catch (unlinkError) {
                    logger.error("Error deleting temporary file:", unlinkError, { path:tempFilePath });
                }
            }
        }
        return null;
    });

export const createUser = onCall<CreateUserData>(async (request) => {

    if(admin.apps.length === 0) {
        admin.initializeApp();
    }

    logger.info("ユーザー作成リクエスト受信:", {
        auth: request.auth?.uid,
        data: request.data,
    });

    if (!request.auth) {
        logger.error("認証されていないユーザーからの呼び出し:", request.data.email );
        throw new HttpsError("unauthenticated","この操作を行うには認証が必要です");
    }


    const { email, password, displayName, role } = request.data;

    if (!password) {
        logger.error("パスワードが指定されていません:", {email: email});
        throw new HttpsError("invalid-argument", "パスワードは必須です");
    }

    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName,
        });

        logger.info(`ユーザー作成成功: ${userRecord.uid}`, { email: email, role: role});

        const userDocRef = admin.firestore().collection('Users').doc(userRecord.uid);
        await userDocRef.set({
            email: email,
            displayName: displayName || '',
            role: role,
            createdAt: FieldValue.serverTimestamp(),
        });
        
        logger.info(`Firestoreにユーザー情報を保存しました: ${userRecord.uid}`);

        return { success: true, uid: userRecord.uid };

    } catch (error: unknown) {
        logger.error("ユーザー作成失敗:", error);

        let errorCode: string | undefined;
        if (typeof error === 'object' && error !== null && 'code' in error && error) {
            errorCode = (error as { code?: string }).code;
        }

        if (errorCode === 'auth/email-already-exists'){
            throw new HttpsError('already-exists', 'このメールアドレスは既に使用されています');
        } else if (errorCode === 'auth/invalid-password') {
            throw new HttpsError('invalid-argument', 'パスワードが有効ではありません。8文字以上必要です。');
        } else {
            throw new HttpsError('internal', 'ユーザー作成中に不明なエラーが発生しました');
        }
    }
});