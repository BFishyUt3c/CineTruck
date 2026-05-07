package com.example.foroservice.Domain.Entities;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.time.LocalDateTime;


@Data
@Document(collection = "threads")
public class ForumThread{

    @Id
    private String id;

    private String userId; // extraido micro-servicio 1
    // extraido micro-servicio 2
    private String movieId; // no estoy seguro si es un Long

    private String title;

    private String body;

    private int votes;

    @Field("created_at")
    private LocalDateTime date;
}
