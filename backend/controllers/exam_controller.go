package controllers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/Maheshkarri4444/wtexamify/config.go"
	"github.com/Maheshkarri4444/wtexamify/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"gopkg.in/gomail.v2"
)

var examCollection *mongo.Collection = config.GetCollection(config.Client, "exams")
var questionSetCollection *mongo.Collection = config.GetCollection(config.Client, "questionsets")

func generateQuestionSets(questions []string, examType string) [][]string {
	var setSize int
	if examType == "viva" {
		setSize = 10
	} else if examType == "external" {
		setSize = 3
	} else if examType == "coaviva" {
		setSize = 15
	} else {
		setSize = 3
	}

	if len(questions) < setSize {
		return nil // Not enough questions to form a single set
	}

	var result [][]string

	if examType == "external" || examType == "internal" {
		// Group questions sequentially in sets of 3, ignoring remaining questions if not a multiple of 3
		for i := 0; i+setSize <= len(questions); i += setSize {
			result = append(result, questions[i:i+setSize])
		}
	} else if examType == "viva" || examType == "coaviva" {
		// Shuffle for viva
		rand.Shuffle(len(questions), func(i, j int) { questions[i], questions[j] = questions[j], questions[i] })
		for i := 0; i+setSize <= len(questions); i += setSize {
			result = append(result, questions[i:i+setSize])
		}
	}

	return result
}

func CreateExam(c *gin.Context) {
	var exam models.Exam

	if err := c.ShouldBindJSON(&exam); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	containerID, exists := c.Get("container_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized user"})
		return
	}
	containerObjID, _ := containerID.(primitive.ObjectID)

	exam.ID = primitive.NewObjectID()
	exam.Status = "stop"
	exam.ExamType = strings.ToLower(exam.ExamType)
	if exam.ExamType != "internal" && exam.ExamType != "external" && exam.ExamType != "viva" && exam.ExamType != "coaviva" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam type"})
		return
	}

	exam.AnswerSheets = []primitive.ObjectID{}
	exam.CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	exam.UpdatedAt = primitive.NewDateTimeFromTime(time.Now())

	// Generate question sets
	questionSets := generateQuestionSets(exam.Questions, exam.ExamType)
	var setIDs []primitive.ObjectID

	for i, questions := range questionSets {
		questionSet := models.QuestionSet{
			ID:        primitive.NewObjectID(),
			ExamID:    exam.ID,
			ExamType:  exam.ExamType,
			SetNumber: i + 1,
			Questions: questions,
			CreatedAt: primitive.NewDateTimeFromTime(time.Now()),
		}
		_, err := questionSetCollection.InsertOne(context.TODO(), questionSet)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create question set"})
			return
		}
		setIDs = append(setIDs, questionSet.ID)
	}

	exam.Sets = setIDs
	_, err := examCollection.InsertOne(context.TODO(), exam)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam"})
		return
	}

	update := bson.M{"$push": bson.M{"exams": bson.M{"exam_id": exam.ID}}}
	_, err = teacherContainerCollection.UpdateOne(context.TODO(), bson.M{"_id": containerObjID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update teacher container"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Exam created successfully", "exam": exam})
}

func UpdateExam(c *gin.Context) {
	examID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(examID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam ID"})
		return
	}

	var updateData struct {
		Name      string   `json:"name,omitempty"`
		Duration  int      `json:"duration,omitempty"`
		Questions []string `json:"questions,omitempty"`
		Status    string   `json:"status,omitempty" validate:"oneof=start stop"`
		ExamType  string   `json:"exam_type,omitempty"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updateFields := bson.M{"updated_at": primitive.NewDateTimeFromTime(time.Now())}

	if updateData.Name != "" {
		updateFields["name"] = updateData.Name
	}
	if updateData.Duration > 0 {
		updateFields["duration"] = updateData.Duration
	}
	if updateData.Status == "start" || updateData.Status == "stop" {
		updateFields["status"] = updateData.Status
	}
	if updateData.ExamType != "" {
		examType := strings.ToLower(updateData.ExamType)
		if examType != "internal" && examType != "external" && examType != "viva" && examType != "coaviva" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam type"})
			return
		}
		updateFields["exam_type"] = examType
	}

	if len(updateData.Questions) > 0 {
		// Fetch current exam to get existing sets
		var existingExam models.Exam
		err := examCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&existingExam)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch existing exam"})
			return
		}

		// Delete only the records in the exam.sets, not the question sets collection
		_, err = questionSetCollection.DeleteMany(context.TODO(), bson.M{"_id": bson.M{"$in": existingExam.Sets}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove existing question sets from exam"})
			return
		}

		// Generate new question sets
		questionSets := generateQuestionSets(updateData.Questions, updateData.ExamType)
		var setIDs []primitive.ObjectID
		for i, questions := range questionSets {
			questionSet := models.QuestionSet{
				ID:        primitive.NewObjectID(),
				ExamID:    objID,
				ExamType:  updateData.ExamType,
				SetNumber: i + 1,
				Questions: questions,
				CreatedAt: primitive.NewDateTimeFromTime(time.Now()),
			}
			_, err := questionSetCollection.InsertOne(context.TODO(), questionSet)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create question set"})
				return
			}
			setIDs = append(setIDs, questionSet.ID)
		}

		updateFields["sets"] = setIDs
	}

	_, err = examCollection.UpdateOne(context.TODO(), bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update exam"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Exam updated successfully, question sets regenerated if needed"})
}

func GetAllStartedExams(c *gin.Context) {
	var exams []models.Exam

	cursor, err := examCollection.Find(context.TODO(), bson.M{"status": "start"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exams"})
		return
	}
	defer cursor.Close(context.TODO())

	if err = cursor.All(context.TODO(), &exams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode exams"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"exams": exams})
}

func GetExamsByTeacherContainerID(c *gin.Context) {
	// fmt.Println("called")
	containerID := c.Param("id")
	containerObjID, err := primitive.ObjectIDFromHex(containerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid container ID"})
		return
	}

	var teacherContainer models.TeacherContainer
	err = teacherContainerCollection.FindOne(context.TODO(), bson.M{"_id": containerObjID}).Decode(&teacherContainer)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Teacher container not found"})
		return
	}

	var exams []models.Exam
	examIDs := []primitive.ObjectID{}
	for _, exam := range teacherContainer.Exams {
		examIDs = append(examIDs, exam.ExamID)
	}

	cursor, err := examCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": examIDs}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exams"})
		return
	}
	defer cursor.Close(context.TODO())

	if err = cursor.All(context.TODO(), &exams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode exams"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"exams": exams})
}

func GetExam(c *gin.Context) {
	examID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(examID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam ID"})
		return
	}

	var exam models.Exam
	err = examCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&exam)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exam"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"exam": exam})
}

func GetSetsByExamID(c *gin.Context) {
	examID, err := primitive.ObjectIDFromHex(c.Param("examID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam ID"})
		return
	}

	var sets []models.QuestionSet
	cursor, err := questionSetCollection.Find(context.TODO(), bson.M{"exam_id": examID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch question sets"})
		return
	}
	defer cursor.Close(context.TODO())

	if err = cursor.All(context.TODO(), &sets); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode question sets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"question_sets": sets})
}

func SendEmails(c *gin.Context) {
	// List of recipient emails
	// emails := []string{"maheshkarri2109@gmain.com",@rguktn.ac.in ,"n210507"@rguktn.ac.in", "vasuch9959@rguktn.ac.in", "maheshkarri2222@gmail.com", "vasu.challapalli9@gmail.com"}
	//cse 4 emails
	// emails := []string{"n210013@rguktn.ac.in", "n210025@rguktn.ac.in", "n210030@rguktn.ac.in", "n210037@rguktn.ac.in", "n210041@rguktn.ac.in", "n210043@rguktn.ac.in", "n210048@rguktn.ac.in", "n210100@rguktn.ac.in", "n210109@rguktn.ac.in", "n210118@rguktn.ac.in", "n210133@rguktn.ac.in", "n210136@rguktn.ac.in", "n210166@rguktn.ac.in", "n210172@rguktn.ac.in", "n210176@rguktn.ac.in", "n210187@rguktn.ac.in", "n210209@rguktn.ac.in", "n210226@rguktn.ac.in", "n210234@rguktn.ac.in", "n210368@rguktn.ac.in", "n210407@rguktn.ac.in", "n210419@rguktn.ac.in", "n210422@rguktn.ac.in", "n210432@rguktn.ac.in", "n210438@rguktn.ac.in", "n210450@rguktn.ac.in", "n210499@rguktn.ac.in", "n210529@rguktn.ac.in", "n210540@rguktn.ac.in", "n210553@rguktn.ac.in", "n210580@rguktn.ac.in", "n210597@rguktn.ac.in", "n210610@rguktn.ac.in", "n210660@rguktn.ac.in", "n210696@rguktn.ac.in", "n210701@rguktn.ac.in", "n210710@rguktn.ac.in", "n210714@rguktn.ac.in", "n210721@rguktn.ac.in", "n210764@rguktn.ac.in", "n210765@rguktn.ac.in", "n210770@rguktn.ac.in", "n210782@rguktn.ac.in", "n210789@rguktn.ac.in", "n210799@rguktn.ac.in", "n210809@rguktn.ac.in", "n210843@rguktn.ac.in", "n210860@rguktn.ac.in", "n210872@rguktn.ac.in", "n210899@rguktn.ac.in", "n210904@rguktn.ac.in", "n210929@rguktn.ac.in", "n210937@rguktn.ac.in", "n210956@rguktn.ac.in", "n211000@rguktn.ac.in", "n211010@rguktn.ac.in", "n211016@rguktn.ac.in", "n211031@rguktn.ac.in", "n211053@rguktn.ac.in", "n211087@rguktn.ac.in", "n210937@rguktn.ac.in", "n210956@rguktn.ac.in", "n211000@rguktn.ac.in", "n211010@rguktn.ac.in", "n211016@rguktn.ac.in", "n211031@rguktn.ac.in", "n211053@rguktn.ac.in", "n211087@rguktn.ac.in"}

	//cse5
	// Email Configuration

	//cse6
	emails := []string{"n201096@rguktn.ac.in", "n210038@rguktn.ac.in", "n210085@rguktn.ac.in", "n210088@rguktn.ac.in", "n210095@rguktn.ac.in", "n210102@rguktn.ac.in", "n210111@rguktn.ac.in", "n210125@rguktn.ac.in", "n210145@rguktn.ac.in", "n210162@rguktn.ac.in", "n210173@rguktn.ac.in", "n210188@rguktn.ac.in", "n210193@rguktn.ac.in", "n210212@rguktn.ac.in", "n210215@rguktn.ac.in", "n210235@rguktn.ac.in", "n210237@rguktn.ac.in", "n210258@rguktn.ac.in", "n210279@rguktn.ac.in", "n210296@rguktn.ac.in", "n210300@rguktn.ac.in", "n210312@rguktn.ac.in", "n210323@rguktn.ac.in", "n210333@rguktn.ac.in", "n210340@rguktn.ac.in", "n210390@rguktn.ac.in", "n210401@rguktn.ac.in", "n210416@rguktn.ac.in", "n210455@rguktn.ac.in", "n210471@rguktn.ac.in", "n210495@rguktn.ac.in", "n210507@rguktn.ac.in", "n210522@rguktn.ac.in", "n210565@rguktn.ac.in", "n210598@rguktn.ac.in", "n210599@rguktn.ac.in", "n210615@rguktn.ac.in", "n210621@rguktn.ac.in", "n210673@rguktn.ac.in", "n210699@rguktn.ac.in", "n210753@rguktn.ac.in", "n210759@rguktn.ac.in", "n210774@rguktn.ac.in", "n210778@rguktn.ac.in", "n210780@rguktn.ac.in", "n210797@rguktn.ac.in", "n210821@rguktn.ac.in", "n210835@rguktn.ac.in", "n210837@rguktn.ac.in", "n210845@rguktn.ac.in", "n210920@rguktn.ac.in", "n210921@rguktn.ac.in", "n210940@rguktn.ac.in", "n210942@rguktn.ac.in", "n210950@rguktn.ac.in", "n210972@rguktn.ac.in", "n210988@rguktn.ac.in", "n210999@rguktn.ac.in", "n211026@rguktn.ac.in", "n210888@rguktn.ac.in"}
	smtpHost := "smtp.gmail.com" // Use your email provider's SMTP
	smtpPort := 587
	senderEmail := "maheshkarri2222@gmail.com" // Replace with your email
	senderPassword := "izlw dibg dojb xpxa"    // Replace with your app password

	// Email Subject & Body
	subject := "Lab Exam Invitation"
	link := "https://wtlabexam.vercel.app"
	bodyTemplate := `
		<html>
			<body style="font-family: Arial, sans-serif; text-align: center;">
				<h2>You are invited to write the Lab Exam</h2>
				<p>Please click the button below to proceed:</p>
				<a href="%s" style="display: inline-block; padding: 10px 20px; font-size: 16px; 
					color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
					Join Exam
				</a>
			</body>
		</html>
	`

	// SMTP Dialer
	dialer := gomail.NewDialer(smtpHost, smtpPort, senderEmail, senderPassword)

	// Loop through each email and send the message
	for _, email := range emails {
		message := gomail.NewMessage()
		message.SetHeader("From", senderEmail)
		message.SetHeader("To", email)
		message.SetHeader("Subject", subject)
		message.SetBody("text/html", fmt.Sprintf(bodyTemplate, link))

		// Send Email
		if err := dialer.DialAndSend(message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send email to %s", email)})
			return
		}
	}

	// Success response
	c.JSON(http.StatusOK, gin.H{"message": "Emails sent successfully"})
}
