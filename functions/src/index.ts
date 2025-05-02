import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
admin.initializeApp();
import { FieldValue } from "firebase-admin/firestore";


interface CreateUserData {
    email: string;
    password: string;
    displayName: string;
    role: string;
}

export const createUser = onCall<CreateUserData>(async (request) => {

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