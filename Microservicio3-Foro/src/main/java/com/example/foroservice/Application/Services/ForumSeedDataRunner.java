package com.example.foroservice.Application.Services;

import com.example.foroservice.Domain.Entities.ForumThread;
import com.example.foroservice.Domain.Entities.Message;
import com.example.foroservice.Domain.Entities.Post;
import com.example.foroservice.Domain.Repositories.MessageRepository;
import com.example.foroservice.Domain.Repositories.PostRepository;
import com.example.foroservice.Domain.Repositories.ThreadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class ForumSeedDataRunner implements CommandLineRunner {

    private final ThreadRepository threadRepository;
    private final PostRepository postRepository;
    private final MessageRepository messageRepository;
    @Value("${app.seed.total-records:20000}")
    private int totalRecords;
    @Value("${app.seed.thread-ratio:0.25}")
    private double threadRatio;
    @Value("${app.seed.post-ratio:0.35}")
    private double postRatio;
    @Value("${app.seed.message-ratio:0.40}")
    private double messageRatio;

    private static final String[] TOPIC_TEMPLATES = {
            "Final explicado de %s",
            "Mejores escenas de %s",
            "Vale la pena volver a ver %s?",
            "Debate: %s esta sobrevalorada?",
            "Recomendaciones parecidas a %s"
    };

    private static final String[] BODY_TEMPLATES = {
            "Quiero leer opiniones de quienes ya la vieron completa.",
            "Me gusto mucho la direccion, pero quiero ver otros puntos de vista.",
            "Que escena creen que define mejor la pelicula?",
            "Que calificacion le pondrian y por que?",
            "La pondrian en su top personal del genero?"
    };

    private static final String[] POST_TEMPLATES = {
            "El guion me parecio solido y muy bien ejecutado.",
            "La fotografia y la musica elevan bastante la experiencia.",
            "Tiene ritmo irregular, pero cierra muy bien.",
            "Me parece de esas peliculas que mejoran en un segundo visionado.",
            "Gran propuesta, aunque no es para todos los gustos."
    };

    private static final String[] MESSAGE_TEMPLATES = {
            "Buen analisis, no habia pensado en ese enfoque.",
            "Coincido contigo, especialmente en la parte del final.",
            "Esa escena cambia completamente la lectura de la historia.",
            "Gracias por la recomendacion, la vere este fin de semana.",
            "Interesante debate, deberiamos abrir otro hilo para spoilers."
    };

    @Override
    public void run(String... args) {
        if (threadRepository.count() > 0 || postRepository.count() > 0 || messageRepository.count() > 0) {
            System.out.println("Seed MS3 omitido: la base de datos ya tiene contenido.");
            return;
        }

        SeedVolumes volumes = resolveVolumes();
        System.out.println("Seed MS3 iniciando con objetivo de " + volumes.total() + " registros.");

        List<ForumThread> threads = buildThreads(volumes.threadCount());
        List<ForumThread> savedThreads = threadRepository.saveAll(threads);

        List<Post> posts = buildPosts(savedThreads, volumes.postCount());
        postRepository.saveAll(posts);

        List<Message> messages = buildMessages(savedThreads, volumes.messageCount());
        messageRepository.saveAll(messages);

        System.out.println("Seed MS3 completado: "
                + savedThreads.size() + " threads, "
                + posts.size() + " posts, "
                + messages.size() + " mensajes.");
    }

    private SeedVolumes resolveVolumes() {
        int safeTotal = Math.max(1000, totalRecords);
        double ratioSum = threadRatio + postRatio + messageRatio;
        if (ratioSum <= 0) {
            return new SeedVolumes(5000, 7000, 8000);
        }

        int threads = (int) Math.round(safeTotal * (threadRatio / ratioSum));
        int posts = (int) Math.round(safeTotal * (postRatio / ratioSum));
        int messages = Math.max(0, safeTotal - threads - posts);

        if (threads < 100) {
            threads = 100;
            posts = Math.max(100, safeTotal / 3);
            messages = Math.max(100, safeTotal - threads - posts);
        }

        return new SeedVolumes(threads, posts, messages);
    }

    private List<ForumThread> buildThreads(int count) {
        LocalDateTime now = LocalDateTime.now();
        List<ForumThread> threads = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            String movieId = String.valueOf(100 + (i % 20000));
            String userId = String.valueOf(1 + (i % 20000));
            String movieLabel = "Pelicula " + movieId;
            String title = String.format(TOPIC_TEMPLATES[i % TOPIC_TEMPLATES.length], movieLabel);
            String body = BODY_TEMPLATES[i % BODY_TEMPLATES.length];
            LocalDateTime date = now.minusMinutes((long) (count - i));
            threads.add(createThread(userId, movieId, title, body, date));
        }

        return threads;
    }

    private List<Post> buildPosts(List<ForumThread> threads, int count) {
        LocalDateTime now = LocalDateTime.now();
        List<Post> posts = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            ForumThread thread = threads.get(i % threads.size());
            String userId = String.valueOf(200 + (i % 20000));
            String body = POST_TEMPLATES[i % POST_TEMPLATES.length];
            LocalDateTime date = now.minusMinutes((long) (count - i) / 2);
            posts.add(createPost(thread.getId(), userId, body, date));
        }

        return posts;
    }

    private List<Message> buildMessages(List<ForumThread> threads, int count) {
        LocalDateTime now = LocalDateTime.now();
        List<Message> messages = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            ForumThread thread = threads.get(i % threads.size());
            String userId = String.valueOf(500 + (i % 20000));
            String text = MESSAGE_TEMPLATES[i % MESSAGE_TEMPLATES.length];
            LocalDateTime timestamp = now.minusMinutes((long) (count - i) / 3);
            messages.add(createMessage(thread.getId(), userId, text, timestamp));
        }

        return messages;
    }

    private ForumThread createThread(String userId, String movieId, String title, String body, LocalDateTime date) {
        ForumThread thread = new ForumThread();
        thread.setUserId(userId);
        thread.setMovieId(movieId);
        thread.setTitle(title);
        thread.setBody(body);
        thread.setVotes(0);
        thread.setDate(date);
        return thread;
    }

    private Post createPost(String threadId, String userId, String body, LocalDateTime date) {
        Post post = new Post();
        post.setThreadId(threadId);
        post.setUserId(userId);
        post.setBody(body);
        post.setVotes(0);
        post.setDate(date);
        return post;
    }

    private Message createMessage(String threadId, String userId, String text, LocalDateTime timestamp) {
        Message message = new Message();
        message.setThreadId(threadId);
        message.setUserId(userId);
        message.setText(text);
        message.setTimestamp(timestamp);
        return message;
    }

    private record SeedVolumes(int threadCount, int postCount, int messageCount) {
        private int total() {
            return threadCount + postCount + messageCount;
        }
    }
}
